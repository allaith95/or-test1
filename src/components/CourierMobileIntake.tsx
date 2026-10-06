import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Package,
  Printer,
  QrCode,
  DollarSign,
  Search,
  CheckCircle,
  Check,
  MapPin,
  Building,
  User,
  Camera,
  Image as ImageIcon,
  X,
  AlertCircle,
  RotateCcw,
  Share2,
  Copy,
  ArrowRight,
  Boxes,
  CreditCard,
  Phone,
  FileText,
  Building2,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Layers,
  Upload,
  Bluetooth,
  Sparkles,
  Lock,
  Users,
  UserCheck,
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
import { FormattedAmountInput } from './FormattedAmountInput';
import { CourierThermalReceiptModal } from './CourierThermalReceiptModal';
import { IdOcrScannerModal } from './IdOcrScannerModal';
import { PhotoFromIndexedDB } from './PhotoFromIndexedDB';
import { savePhoto } from '../utils/photoStorage';
import {
  DEFAULT_PACKAGE_TYPES,
  DEFAULT_ID_DOCUMENT_TYPES,
  ALL_BRANCHES_SUPERVISION_BRANCH,
} from '../data/initialData';
import { sanitizePhone, sanitizeDigitsOnly } from '../utils/numberSanitizer';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import {
  normalizeCustomerNames,
  normalizePhoneForComparison,
  normalizeArabicComparison,
  getCanonicalCustomerKey,
} from '../utils/nameUtils';
import { validateParcelForm } from '../shared/parcelValidation';
import { searchCustomers } from '../shared/useCustomerDirectory';
import { computeParcelFinancialSummary } from '../shared/financialCalculations';
import { CustomerDirectoryModal } from './CustomerDirectoryModal';

interface CourierMobileIntakeProps {
  onBack: () => void;
}

export const CourierMobileIntake: React.FC<CourierMobileIntakeProps> = ({ onBack }) => {
  const {
    currentBranch,
    branches,
    currentUser,
    registerParcel,
    openPrintModal,
    customers,
    brandingSettings,
    calculatePrice,
    calculateCodTransferFee,
    formatCurrency,
    addAuditLog,
    handoverCourierParcelsToHub,
  } = useOrca();

  // Dynamic lists from central branding
  const packageTypes: string[] =
    brandingSettings.packageTypes && brandingSettings.packageTypes.length > 0
      ? brandingSettings.packageTypes
      : DEFAULT_PACKAGE_TYPES;

  const idDocumentTypes: string[] =
    brandingSettings.idDocumentTypes && brandingSettings.idDocumentTypes.length > 0
      ? brandingSettings.idDocumentTypes
      : DEFAULT_ID_DOCUMENT_TYPES;

  // =========================================================================
  // 1. FIXED ORIGIN HUB: (مركز الإنطلاق مثبت تلقائياً من المركز الرئيسي التابع له الموزع)
  // =========================================================================
  const originHub = useMemo(() => {
    const courierBranch = branches.find((b) => b.id === currentUser.branchId);
    if (courierBranch) {
      if (courierBranch.type === 'main_hub' || !courierBranch.parentHubId) {
        return courierBranch;
      }
      const parentMainHub = branches.find((b) => b.id === courierBranch.parentHubId);
      if (parentMainHub) return parentMainHub;
      return courierBranch;
    }
    const mainHub = branches.find((b) => b.type === 'main_hub');
    return mainHub || currentBranch || branches[0] || ALL_BRANCHES_SUPERVISION_BRANCH;
  }, [branches, currentUser.branchId, currentBranch]);

  // =========================================================================
  // 2. DESTINATION HUBS: (لا يظهر فيه المركز التابع له الموزع، فقط الفروع الأخرى الرئيسية)
  // =========================================================================
  const destinationBranches = useMemo(() => {
    return branches.filter((b) => {
      // Must be a main hub (فرع رئيسي فقط)
      const isMainHub = b.type === 'main_hub' || (!b.parentHubId && b.type !== 'collection_point');
      if (!isMainHub) return false;
      // Must NOT be the courier's origin hub
      if (b.id === originHub.id) return false;
      // Must NOT be the courier's own branch
      if (currentUser.branchId && b.id === currentUser.branchId) return false;
      return true;
    });
  }, [branches, originHub.id, currentUser.branchId]);

  // Prompt 67: Destination hub starts strictly empty on initial render (not prefilled)
  const [destHubId, setDestHubId] = useState<string>('');

  // Clear destHubId if the selected branch is no longer in valid destination branches
  useEffect(() => {
    if (destHubId && !destinationBranches.some((b) => b.id === destHubId)) {
      setDestHubId('');
    }
  }, [destinationBranches, destHubId]);

  const selectedDestBranch = useMemo(() => {
    if (!destHubId) return null;
    return destinationBranches.find((b) => b.id === destHubId) || null;
  }, [destinationBranches, destHubId]);

  const destGovernorate: Governorate = (selectedDestBranch?.governorate as Governorate) || 'دمشق';

  // =========================================================================
  // 3. SENDER FIELDS (بيانات المرسل مرتبة بدقة حسب الطلب):
  // الاسم - الأب - الكنية - الام - تاريخ الولادة - رقم الوثيقة (الرقم الوطني) - رقم الهاتف - صور الهوية
  // =========================================================================
  const [senderFirstName, setSenderFirstName] = useState('');
  const [senderFatherName, setSenderFatherName] = useState('');
  const [senderLastName, setSenderLastName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderMotherName, setSenderMotherName] = useState('');
  const [senderBirthDate, setSenderBirthDate] = useState('');
  const [senderNationalId, setSenderNationalId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderIdType, setSenderIdType] = useState<string>(idDocumentTypes[0] || 'هوية سورية');
  const [senderIdPhotoUrl, setSenderIdPhotoUrl] = useState('');
  const [senderIdBackPhotoUrl, setSenderIdBackPhotoUrl] = useState('');
  const [showOcrScanner, setShowOcrScanner] = useState(false);

  // Sender Autocomplete & Directory Matching
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSenderSuggestions, setShowSenderSuggestions] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomerDirectoryOpen, setIsCustomerDirectoryOpen] = useState(false);

  // Automatic Triple Name Synchronization for Sender (المرسل)
  const syncSenderTripleName = (first: string, father: string, last: string) => {
    const combined = [first.trim(), father.trim(), last.trim()].filter(Boolean).join(' ');
    setSenderName(combined);
  };

  // Handle extracted data from OCR scanner modal
  const handleOcrDataExtracted = async (data: {
    firstName: string;
    fatherName: string;
    lastName: string;
    motherName: string;
    nationalId: string;
    birthDate: string;
    photoDataUrl: string;
  }) => {
    if (data.firstName) setSenderFirstName(data.firstName);
    if (data.fatherName) setSenderFatherName(data.fatherName);
    if (data.lastName) setSenderLastName(data.lastName);
    if (data.motherName) setSenderMotherName(data.motherName);
    if (data.nationalId) setSenderNationalId(data.nationalId);
    if (data.birthDate) setSenderBirthDate(data.birthDate);
    if (data.photoDataUrl) {
      try {
        const photoKey = await savePhoto(data.photoDataUrl, 'sender_id_front');
        setSenderIdPhotoUrl(photoKey);
      } catch (err) {
        console.error('Failed to save photo to storage:', err);
        alert('فشل حفظ صورة الهوية في الذاكرة المحلية. يرجى إعادة المحاولة.');
        return;
      }
    }
    syncSenderTripleName(data.firstName, data.fatherName, data.lastName);
  };

  // Lookup sender suggestions across Customer Directory using shared searchCustomers helper
  const lookupSenderSuggestions = (query: string) => {
    if (!query || query.trim().length < 2) {
      setCustomerSuggestions([]);
      setShowSenderSuggestions(false);
      return;
    }
    const matches = searchCustomers(customers, { query, limit: 5 });
    setCustomerSuggestions(matches);
    setShowSenderSuggestions(matches.length > 0);
  };

  const handleSenderFirstNameChange = (val: string) => {
    setSenderFirstName(val);
    syncSenderTripleName(val, senderFatherName, senderLastName);
    lookupSenderSuggestions(val);
  };

  const handleSenderFatherNameChange = (val: string) => {
    setSenderFatherName(val);
    syncSenderTripleName(senderFirstName, val, senderLastName);
    lookupSenderSuggestions([senderFirstName, val, senderLastName].filter(Boolean).join(' '));
  };

  const handleSenderLastNameChange = (val: string) => {
    setSenderLastName(val);
    syncSenderTripleName(senderFirstName, senderFatherName, val);
    lookupSenderSuggestions([senderFirstName, senderFatherName, val].filter(Boolean).join(' '));
  };

  const handleSenderNameDirectChange = (val: string) => {
    setSenderName(val);
    const parts = val.trim().split(/\s+/);
    if (parts.length === 3) {
      setSenderFirstName(parts[0]);
      setSenderFatherName(parts[1]);
      setSenderLastName(parts[2]);
    } else if (parts.length === 2) {
      setSenderFirstName(parts[0]);
      setSenderFatherName('');
      setSenderLastName(parts[1]);
    }
    lookupSenderSuggestions(val);
  };

  // Handle Autocomplete Lookup for Sender Phone
  const handleSenderPhoneChange = (val: string) => {
    const cleaned = sanitizePhone(val);
    setSenderPhone(cleaned);
    lookupSenderSuggestions(cleaned);
  };

  const handleSenderNationalIdChange = (val: string) => {
    const sanitized = sanitizeDigitsOnly(val);
    setSenderNationalId(sanitized);
    lookupSenderSuggestions(sanitized);
  };

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id || null);
    setSenderName(cust.fullName || '');
    setSenderFirstName(cust.firstName || '');
    setSenderFatherName(cust.fatherName || '');
    setSenderLastName(cust.lastName || '');
    setSenderPhone(cust.phone || '');
    if (cust.nationalId) setSenderNationalId(cust.nationalId);
    if (cust.idType) setSenderIdType(cust.idType);
    if (cust.idPhotoFront) setSenderIdPhotoUrl(cust.idPhotoFront);
    if (cust.idPhotoBack) setSenderIdBackPhotoUrl(cust.idPhotoBack);
    if (cust.motherName) setSenderMotherName(cust.motherName);
    if (cust.birthDate) setSenderBirthDate(cust.birthDate);
    setShowSenderSuggestions(false);
  };

  const handleSelectCustomerFromDirectory = (customer: Customer) => {
    const fName = customer.firstName || customer.fullName.split(' ')[0] || '';
    const father = customer.fatherName || '';
    const lName = customer.lastName || '';
    setSenderFirstName(fName);
    setSenderFatherName(father);
    setSenderLastName(lName);
    setSenderMotherName(customer.motherName || '');
    setSenderBirthDate(customer.birthDate || '');
    setSenderNationalId(customer.nationalId || '');
    setSenderIdType(customer.idType || idDocumentTypes[0] || 'هوية سورية');
    setSenderPhone(customer.phone || '');
    setSenderName(customer.fullName || `${fName} ${father} ${lName}`.trim());

    // Photos
    if (customer.idPhotoFront) setSenderIdPhotoUrl(customer.idPhotoFront);
    if (customer.idPhotoBack) setSenderIdBackPhotoUrl(customer.idPhotoBack);

    // Link
    setSelectedCustomerId(customer.id);
    setIsCustomerDirectoryOpen(false);

    // Audit Log
    addAuditLog(
      'ربط عميل من الدليل',
      'parcels',
      `تم ربط المرسل [${customer.fullName}] من دليل العملاء الموحد.`
    );
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId(null);
    setSenderName('');
    setSenderFirstName('');
    setSenderFatherName('');
    setSenderLastName('');
    setSenderMotherName('');
    setSenderBirthDate('');
    setSenderNationalId('');
    setSenderPhone('');
    setSenderIdPhotoUrl('');
    setSenderIdBackPhotoUrl('');
  };

  const getRateLabel = (type: string): string => {
    const rates = brandingSettings.packageTypeRates?.[type];
    if (!rates) return '';
    if (rates.fixedPriceSyp && rates.fixedPriceSyp > 0) {
      return ` — ${rates.fixedPriceSyp.toLocaleString()} ل.س`;
    }
    if (rates.minPriceSyp && rates.minPriceSyp > 0) {
      return ` — من ${rates.minPriceSyp.toLocaleString()} ل.س`;
    }
    return '';
  };

  // =========================================================================
  // 4. RECEIVER FIELDS (اسم المستلم الكامل و رقم هاتفه و عنوان التسليم فقط للمستلم)
  // =========================================================================
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');

  // =========================================================================
  // 5. PACKAGE SPECS
  // =========================================================================
  const [shippingCategory, setShippingCategory] = useState<ShippingCategory>('postal');
  const [packageType, setPackageType] = useState<string>(packageTypes[0] || 'كرتون عادي');
  const [weightKg, setWeightKg] = useState('1');
  const [piecesCount, setPiecesCount] = useState('1');
  const [packageNotes, setPackageNotes] = useState('');
  const [contentDescription, setContentDescription] = useState('');
  const [paperReceiptNumber, setPaperReceiptNumber] = useState('');

  // =========================================================================
  // 6. FINANCIALS & COD (ربط النظام المالي وأجور الشحن بمحرك التسعير بكل دقة)
  // =========================================================================
  const [paymentType, setPaymentType] = useState<PaymentType>('collect');
  const [currency, setCurrency] = useState<Currency>('SYP');
  const [codCurrency, setCodCurrency] = useState<Currency>('SYP');
  const [codShippingPayer, setCodShippingPayer] = useState<'recipient' | 'sender'>('recipient');
  const [shippingCost, setShippingCost] = useState(15000);
  const [codAmount, setCodAmount] = useState(0);
  const [customTransferFee, setCustomTransferFee] = useState<number | null>(null);
  const [isManualShippingCostOverride, setIsManualShippingCostOverride] = useState(false);

  // =========================================================================
  // EXACT PRICING ENGINE LINK (محرك التسعير الرسمي للأجور الدقيقة)
  // =========================================================================
  const pricingEngineResult = useMemo(() => {
    const weight = Math.max(0.1, Number(weightKg) || 1);
    const cod = paymentType === 'cod' ? Number(codAmount) || 0 : 0;
    return calculatePrice(
      originHub.governorate,
      destGovernorate,
      packageType as PackageType,
      weight,
      20,
      20,
      20,
      paymentType,
      currency,
      cod,
      'auto',
      undefined,
      codCurrency
    );
  }, [
    calculatePrice,
    originHub.governorate,
    destGovernorate,
    packageType,
    weightKg,
    paymentType,
    currency,
    codAmount,
    codCurrency,
  ]);

  // Keep shipping cost automatically bound to Pricing Engine unless manually overridden
  useEffect(() => {
    if (!isManualShippingCostOverride) {
      setShippingCost(pricingEngineResult.shippingCost);
    }
  }, [pricingEngineResult.shippingCost, isManualShippingCostOverride]);

  // Shared authoritative financial calculation
  const financialSummary = useMemo(() => {
    const ship = Number(shippingCost) || 0;
    return computeParcelFinancialSummary({
      paymentType,
      currency,
      codCurrency,
      shippingCost: ship,
      codAmount: Number(codAmount) || 0,
      codShippingPayer,
      calculateTransferFee: (amt, curr) => {
        if (customTransferFee !== null) return customTransferFee;
        return pricingEngineResult.transferFee || calculateCodTransferFee(amt, curr);
      },
    });
  }, [
    paymentType,
    currency,
    codCurrency,
    shippingCost,
    codAmount,
    codShippingPayer,
    customTransferFee,
    pricingEngineResult.transferFee,
    calculateCodTransferFee,
  ]);

  const calculatedCodTransferFee = financialSummary.transferFee;
  const calculatedTotalDue = financialSummary.totalDueFromReceiver;

  // =========================================================================
  // Accordion Sections State & Error Trackers
  // =========================================================================
  const [isSenderOpen, setIsSenderOpen] = useState(true);
  const [isReceiverOpen, setIsReceiverOpen] = useState(false);
  const [isPackageOpen, setIsPackageOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const [isExtraOpen, setIsExtraOpen] = useState(false);

  // Dynamic validation & error counters per section
  const senderErrorsCount = useMemo(() => {
    let count = 0;
    if (!senderFirstName.trim()) count++;
    if (!senderFatherName.trim()) count++;
    if (!senderLastName.trim()) count++;
    if (!senderMotherName.trim()) count++;
    if (!senderBirthDate.trim()) count++;
    if (!senderNationalId.trim()) count++;
    if (!senderPhone.trim()) count++;
    return count;
  }, [senderFirstName, senderFatherName, senderLastName, senderMotherName, senderBirthDate, senderNationalId, senderPhone]);

  const receiverErrorsCount = useMemo(() => {
    let count = 0;
    if (!destHubId) count++;
    if (!receiverName.trim()) count++;
    if (!receiverPhone.trim()) count++;
    if (!receiverAddress.trim()) count++;
    return count;
  }, [destHubId, receiverName, receiverPhone, receiverAddress]);

  const packageErrorsCount = useMemo(() => {
    let count = 0;
    if (!contentDescription.trim()) count++;
    if (!weightKg || Number(weightKg) <= 0) count++;
    return count;
  }, [contentDescription, weightKg]);

  const financialErrorsCount = useMemo(() => {
    let count = 0;
    if (!shippingCost || Number(shippingCost) <= 0) count++;
    if (paymentType === 'cod') {
      const codNum = Number(codAmount) || 0;
      if (codNum <= 0) count++;
      if (pricingEngineResult?.maxCodAmount && codNum > pricingEngineResult.maxCodAmount) count++;
    }
    return count;
  }, [shippingCost, paymentType, codAmount, pricingEngineResult?.maxCodAmount]);

  const totalErrorsCount = senderErrorsCount + receiverErrorsCount + packageErrorsCount + financialErrorsCount;

  // Completed core fields progress out of 10
  const completedFieldsCount = useMemo(() => {
    let count = 0;
    if (senderFirstName.trim()) count++;
    if (senderFatherName.trim()) count++;
    if (senderLastName.trim()) count++;
    if (senderMotherName.trim()) count++;
    if (senderNationalId.trim()) count++;
    if (senderPhone.trim()) count++;
    if (receiverName.trim()) count++;
    if (receiverPhone.trim()) count++;
    if (receiverAddress.trim()) count++;
    if (contentDescription.trim()) count++;
    return count;
  }, [senderFirstName, senderFatherName, senderLastName, senderMotherName, senderNationalId, senderPhone, receiverName, receiverPhone, receiverAddress, contentDescription]);

  const hasExtraData = Boolean(packageNotes.trim() || paperReceiptNumber.trim());

  // Success State & Modals
  const [registeredParcelSuccess, setRegisteredParcelSuccess] = useState<Parcel | null>(null);
  const [validationErrorsBanner, setValidationErrorsBanner] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHandedOverSuccess, setIsHandedOverSuccess] = useState(false);
  const [copiedTrackingSuccess, setCopiedTrackingSuccess] = useState(false);
  const [showThermalReceiptModal, setShowThermalReceiptModal] = useState(false);
  const [autoTriggerBluetooth, setAutoTriggerBluetooth] = useState(false);

  // Hidden File Inputs for Camera / File Capture
  const senderFrontCameraRef = useRef<HTMLInputElement | null>(null);
  const senderBackCameraRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Convert Captured Camera File to Base64 and persist in IndexedDB
  const handleImageCapture = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    prefix: string = 'sender_id'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let cancelled = false;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        try {
          const photoKey = await savePhoto(reader.result, prefix);
          if (!cancelled && isMountedRef.current) {
            setter(photoKey);
          }
        } catch (err) {
          console.error('Failed to save photo to storage:', err);
          if (!cancelled && isMountedRef.current) {
            setValidationErrorsBanner(['فشل حفظ الصورة في الذاكرة المحلية. يرجى المحاولة مجدداً.']);
          }
        }
      }
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  };

  // Submit Parcel Intake with strict validation matching the General App
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalSenderName =
      senderName.trim() ||
      `${senderFirstName} ${senderFatherName} ${senderLastName}`.trim();
    const finalReceiverName = receiverName.trim();

    // Perform strict validation using the shared module
    const validation = validateParcelForm({
      packageType,
      senderFirstName,
      senderFatherName,
      senderLastName,
      senderMotherName,
      senderBirthDate,
      senderNationalId,
      senderPhone,
      senderIdPhotoFront: senderIdPhotoUrl,
      senderIdPhotoBack: senderIdBackPhotoUrl,
      receiverName: finalReceiverName,
      receiverPhone,
      destinationHubId: selectedDestBranch?.id || '',
      originHubId: originHub?.id || '',
      destinationAddress: receiverAddress,
      activeShippingCost: shippingCost,
      currentPackageTypeMinPrice: pricingEngineResult?.basePrice || 0,
      weightKg: Number(weightKg) || 0,
      packageNotes,
      contentDescription: contentDescription.trim() || packageNotes.trim() || 'طرد لوجستي',
      paymentType,
      codAmount: Number(codAmount) || 0,
      codCurrency,
      currency,
      maxCodAllowedFromEngine: pricingEngineResult?.maxCodAllowed,
    });

    // Validate COD mandatory amount & max ceiling
    if (paymentType === 'cod') {
      const codNum = Number(codAmount) || 0;
      if (codNum <= 0) {
        setValidationErrorsBanner(['شرط إلزامي: يجب إدخال مبلغ الحوالة المالية (ضد الدفع COD) أكبر من الصفر']);
        setIsFinancialOpen(true);
        return;
      }
      if (pricingEngineResult?.maxCodAmount && codNum > pricingEngineResult.maxCodAmount) {
        setValidationErrorsBanner([
          `لا يمكن المتابعة: مبلغ الحوالة يتجاوز السقف الأعلى المسموح به (${formatCurrency(pricingEngineResult.maxCodAmount, codCurrency)})`
        ]);
        setIsFinancialOpen(true);
        return;
      }
    }

    if (!validation.valid) {
      // Automatically expand first section containing validation errors
      if (senderErrorsCount > 0) setIsSenderOpen(true);
      else if (receiverErrorsCount > 0) setIsReceiverOpen(true);
      else if (packageErrorsCount > 0) setIsPackageOpen(true);
      else if (financialErrorsCount > 0) setIsFinancialOpen(true);

      setValidationErrorsBanner(validation.errors);
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (_) {}
      return;
    }

    setValidationErrorsBanner([]);
    setIsSubmitting(true);

    try {
      const autoReceipt = paperReceiptNumber.trim() || '';

      // Match sender against general customer directory to strictly prevent duplicate customer entries
      let resolvedCustomerId = selectedCustomerId;
      if (!resolvedCustomerId) {
        const cleanPhone = senderPhone.trim();
        const cleanNid = senderNationalId.trim();
        const norm = normalizeCustomerNames({
          fullName: finalSenderName,
          firstName: senderFirstName.trim(),
          fatherName: senderFatherName.trim(),
          lastName: senderLastName.trim(),
        });
        const matched = customers.find((c) => {
          if (cleanNid && cleanNid.length >= 7) {
            const cNid = (c.nationalId || '').replace(/\D/g, '');
            if (cNid === cleanNid.replace(/\D/g, '')) return true;
          }
          if (cleanPhone && cleanPhone.length >= 6) {
            const pA = normalizePhoneForComparison(c.phone);
            const pB = normalizePhoneForComparison(cleanPhone);
            if (pA && pB && pA === pB) return true;
          }
          const nA = normalizeArabicComparison(c.fullName);
          const nB = normalizeArabicComparison(norm.fullName);
          if (nA && nB && nA.length >= 4 && nA === nB) return true;
          return false;
        });
        if (matched) {
          resolvedCustomerId = matched.id;
        }
      }

    if (!selectedDestBranch || !destHubId) {
      setValidationErrorsBanner(['يرجى اختيار فرع أو مركز الوجهة المستلمة']);
      setIsReceiverOpen(true);
      return;
    }

    const newParcel = registerParcel({
      paperReceiptNumber: autoReceipt,
      originHubId: originHub.id,
      originBranchId: originHub.id,
      originCollectionBranchId: currentUser.branchId || originHub.id,
      destinationHubId: selectedDestBranch.id,
        destinationAddress: receiverAddress.trim(),
        sender: {
          name: finalSenderName,
          firstName: senderFirstName.trim() || undefined,
          fatherName: senderFatherName.trim() || undefined,
          lastName: senderLastName.trim() || undefined,
          motherName: senderMotherName.trim() || undefined,
          birthDate: senderBirthDate.trim() || undefined,
          nationalId: senderNationalId.trim() || undefined,
          phone: senderPhone.trim(),
          city: originHub.governorate || originHub.city || originHub.name,
          address: originHub.address || `مدينة ${originHub.governorate || originHub.city || originHub.name}`,
          idType: senderIdType as any,
          idPhotoFront: senderIdPhotoUrl || undefined,
          idPhotoBack: senderIdBackPhotoUrl || undefined,
          customerId: selectedCustomerId || resolvedCustomerId || undefined,
        },
        receiver: {
          name: finalReceiverName,
          phone: receiverPhone.trim(),
          address: receiverAddress.trim(),
          city: selectedDestBranch.governorate || selectedDestBranch.city || selectedDestBranch.name,
        },
        packageType: packageType as PackageType,
        shippingCategory,
        sizeTier: 'medium',
        pricingBasis: isManualShippingCostOverride ? 'auto' : 'weight_only',
        appliedBasis: (pricingEngineResult.appliedBasis as any) || 'weight',
        packageNotes: packageNotes.trim() || undefined,
        piecesCount: Math.max(1, Number(piecesCount) || 1),
        weightKg: Math.max(0.1, Number(weightKg) || 1),
        dimensions: {
          lengthCm: 20,
          widthCm: 20,
          heightCm: 20,
        },
        volumeCbm: (20 * 20 * 20) / 1000000,
        distanceKm: pricingEngineResult.distanceKm,
        isManualPricing: isManualShippingCostOverride,
        manualShippingCost: isManualShippingCostOverride ? Number(shippingCost) : undefined,
        currentLocationBranchId: originHub.id,
        storedWarehouseType: 'standard_received',
        shortageStatus: 'none',
        senderName: finalSenderName,
        receiverName: finalReceiverName,
        priceSyp: currency === 'SYP' ? Number(shippingCost) : undefined,
        contentDescription:
          contentDescription.trim() ||
          packageNotes.trim() ||
          (shippingCategory === 'postal' ? 'مستندات ووثائق بريدية' : 'بضائع عامة مشحونة'),
        specialInstructions: packageNotes ? `ملاحظة: ${packageNotes}` : undefined,
        paymentType,
        codShippingPayer: paymentType === 'cod' ? codShippingPayer : undefined,
        currency,
        shippingCurrency: currency,
        codCurrency: paymentType === 'cod' ? codCurrency : undefined,
        transferFeeCurrency: paymentType === 'cod' ? codCurrency : undefined,
        shippingCost: Number(shippingCost) || 0,
        codAmount: paymentType === 'cod' ? Number(codAmount) || 0 : 0,
        transferFee: calculatedCodTransferFee,
        totalDue: calculatedTotalDue,
        customerId: selectedCustomerId || resolvedCustomerId || undefined,
        // Recorded in outbound branch registry as if Outbound Officer recorded it:
        createdById: currentUser.id,
        createdByName: 'مسؤول الصادر',
        registeredByUserName: 'مسؤول الصادر',
        // Distinct field attribution: executed by courier only:
        isCourierPickup: true,
        registeredByCourierName: currentUser.name || currentUser.username,
        collectedByCourierName: currentUser.name || currentUser.username,
        collectedByCourierId: currentUser.id,
        storageGraceDays: 3,
        notificationDueHours: 24,
      });

      // Audit Log
      addAuditLog(
        'تسجيل طرد ميداني',
        'parcels',
        `سجل الموزع [${currentUser.name}] شحنة جديدة [${newParcel.trackingNumber}] من المركز [${originHub.name}] إلى الوجهة [${selectedDestBranch.name}] لصالح [${finalReceiverName}]. تم تسجيل العملية بصادر الفرع مع دلالة الموزع المنفذ فقط.`
      );

      setIsHandedOverSuccess(false);
      setRegisteredParcelSuccess(newParcel);
      setIsSubmitting(false);
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الشحنة: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setRegisteredParcelSuccess(null);
    setValidationErrorsBanner([]);
    setIsHandedOverSuccess(false);
    setDestHubId('');
    setReceiverAddress('');
    setReceiverName('');
    setReceiverPhone('');
    setCurrency('SYP');
    setCodCurrency('SYP');
    setPaymentType('collect');
    setCodShippingPayer('recipient');
    setPackageType(packageTypes[0] || 'كرتون عادي');
    setSenderName('');
    setSenderFirstName('');
    setSenderFatherName('');
    setSenderLastName('');
    setSenderMotherName('');
    setSenderBirthDate('');
    setSenderNationalId('');
    setSenderPhone('');
    setSenderIdPhotoUrl('');
    setSenderIdBackPhotoUrl('');
    setPackageNotes('');
    setContentDescription('');
    setPiecesCount('1');
    setWeightKg('1');
    setIsManualShippingCostOverride(false);
    setCodAmount(0);
    setPaperReceiptNumber('');
  };

  // WhatsApp Share Helper
  const handleShareWhatsApp = (parcel: Parcel) => {
    const summary = getParcelPaymentSummary(parcel);
    const destCity =
      branches.find((b) => b.id === parcel.destinationHubId)?.city || 'الفرع';
    const msg = `مرحباً بك! تم استلام وتوثيق طردك بنجاح عبر موزع أوركا إكسبريس [${currentUser.name}].\n📦 رقم البوليصة: ${parcel.trackingNumber}\n📍 مركز الانطلاق: ${originHub.name}\n📍 الوجهة: ${destCity}\n💵 المطلوب تحصيله: ${summary.summaryDueText}\nشكراً لثقتكم بأوركا إكسبريس للشحن البري!`;
    const cleanPhone = (parcel.sender.phone || '').replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('0') ? '963' + cleanPhone.slice(1) : cleanPhone;
    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (_) {
      window.location.href = url;
    }
  };

  return (
    <div className="space-y-4 pb-12 font-['Cairo',sans-serif]" dir="rtl">
      
      {/* Hidden Mobile Camera Inputs (Front & Back IDs) */}
      <input
        ref={senderFrontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageCapture(e, setSenderIdPhotoUrl, 'sender_id_front')}
      />
      <input
        ref={senderBackCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageCapture(e, setSenderIdBackPhotoUrl, 'sender_id_back')}
      />

      {/* Top Header Bar — Streamlined & Compact */}
      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={onBack}
          className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 text-amber-400" />
          <span>رجوع</span>
        </button>

        <div className="text-center">
          <h2 className="text-xs sm:text-sm font-black text-white flex items-center justify-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>تسجيل طرد جديد</span>
          </h2>
        </div>

        {/* Progress Badge Indicator */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-xl text-[10px] font-mono font-bold text-emerald-400 transition-all duration-200">
          <span className="animate-in fade-in duration-150">{completedFieldsCount}/10</span>
          <span className="text-[9px] text-slate-400 font-sans hidden sm:inline">حقول</span>
        </div>
      </div>

      {/* In-App Validation Error Banner (Tactile Mobile Feedback, Zero window.alert) */}
      {validationErrorsBanner.length > 0 && (
        <div className="bg-rose-950/90 border-2 border-rose-500/60 rounded-2xl p-3.5 shadow-xl space-y-2 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
              <span className="text-xs font-black">يرجى استكمال الحقول الإلزامية المطلوبة:</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationErrorsBanner([])}
              className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="text-[11px] text-rose-200/90 space-y-1 pr-2 font-medium border-r-2 border-rose-500/40">
            {validationErrorsBanner.map((err, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="text-rose-400">•</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUCCESS OVERLAY IF REGISTERED                                             */}
      {/* ========================================================================= */}
      {registeredParcelSuccess ? (
        <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl space-y-3.5 text-center animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <CheckCircle className="w-7 h-7" />
          </div>

          <div>
            <span className="text-xs text-emerald-400 font-bold block">
              تم تسجيل البوليصة وإدراجها بالنظام بنجاح!
            </span>
            <h3 className="text-xl font-black text-white font-mono mt-1 tracking-wider" dir="ltr">
              {registeredParcelSuccess.trackingNumber}
            </h3>
          </div>

          {/* Quick Summary Card */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 text-right">
            <div className="flex justify-between border-b border-slate-800/80 pb-1">
              <span className="text-slate-400 font-bold">المسار:</span>
              <span className="font-bold text-amber-300">{originHub.name} ({originHub.governorate}) ➔ {selectedDestBranch?.name} ({destGovernorate})</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-1">
              <span className="text-slate-400 font-bold">المرسل:</span>
              <span className="font-bold text-white">{registeredParcelSuccess.sender?.name || '—'} ({registeredParcelSuccess.sender?.phone || '—'})</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-1">
              <span className="text-slate-400 font-bold">المستلم:</span>
              <span className="font-bold text-white">{registeredParcelSuccess.receiver?.name || '—'} ({registeredParcelSuccess.receiver?.phone || '—'})</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-400 font-bold">المطلوب تحصيله:</span>
              <span className="font-black text-emerald-300 text-sm">
                {formatCurrency(registeredParcelSuccess.totalDue, registeredParcelSuccess.currency)}
              </span>
            </div>
          </div>

          {/* Status & Center Handover Section */}
          <div className="space-y-2 text-right">
            <div
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                isHandedOverSuccess
                  ? 'bg-blue-950/80 border-blue-500/50 text-blue-200'
                  : 'bg-purple-950/80 border-purple-500/50 text-purple-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isHandedOverSuccess ? 'bg-blue-400' : 'bg-purple-400 animate-pulse'
                  }`}
                />
                <span>الحالة:</span>
                <span className={`font-black ${isHandedOverSuccess ? 'text-blue-300' : 'text-purple-300'}`}>
                  {isHandedOverSuccess ? 'بمركز الانطلاق 🏬' : 'مع المندوب 🛵'}
                </span>
              </div>
            </div>

            {!isHandedOverSuccess ? (
              <button
                type="button"
                onClick={() => {
                  if (registeredParcelSuccess) {
                    handoverCourierParcelsToHub([registeredParcelSuccess.id]);
                    setIsHandedOverSuccess(true);
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 cursor-pointer active:scale-98 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>تسليم الطرود للمركز</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>تم التسليم لمركز الانطلاق بنجاح!</span>
              </div>
            )}
          </div>

          {/* Printing Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAutoTriggerBluetooth(true);
                setShowThermalReceiptModal(true);
              }}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-98 transition-transform"
            >
              <Bluetooth className="w-4 h-4" />
              <span>🖨️ طباعة حرارية (80mm)</span>
            </button>

            <button
              type="button"
              onClick={() => openPrintModal('parcel_3part', registeredParcelSuccess)}
              className="py-3 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer active:scale-98 transition-transform"
            >
              <Printer className="w-4 h-4" />
              <span>📄 طباعة A4</span>
            </button>
          </div>

          {/* Social Share & Copy Tracking */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => handleShareWhatsApp(registeredParcelSuccess)}
              className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/30 cursor-pointer active:scale-95 transition-transform"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>واتساب</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!navigator?.clipboard) return;
                navigator.clipboard.writeText(registeredParcelSuccess.trackingNumber);
                setCopiedTrackingSuccess(true);
                setTimeout(() => setCopiedTrackingSuccess(false), 2000);
              }}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 transition-transform"
            >
              {copiedTrackingSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTrackingSuccess ? 'تم النسخ' : 'نسخ التتبع'}</span>
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetForm}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-transform"
            >
              <Package className="w-4 h-4" />
              <span>➕ طرد جديد آخر</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs sm:text-sm cursor-pointer active:scale-95 transition-transform"
            >
              ✅ تم
            </button>
          </div>
        </div>
      ) : (
        /* ======================================================================= */
        /* STREAMLINED ACCORDION FORM WITH STICKY FOOTER                           */
        /* ======================================================================= */
        <form onSubmit={handleSubmit} className="space-y-3 pb-28">
          
          {/* OCR hidden for v2 — see HANDOVER.md */}

          {/* ===================================================================== */}
          {/* 1. ID CARD PHOTOS — ALWAYS OPEN AT TOP (Photos-First UX)              */}
          {/* ===================================================================== */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-100 tracking-wide">1. صور بطاقة الهوية</h3>
                  <span className="text-[10px] text-slate-400 block">تصوير الوجهين الأمامي والخلفي للهوية السورية</span>
                </div>
              </div>
              {senderIdPhotoUrl && senderIdBackPhotoUrl ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> ✅ الهوية مكتملة
                </span>
              ) : senderIdPhotoUrl || senderIdBackPhotoUrl ? (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
                  🔴 الوجه الثاني مطلوب
                </span>
              ) : (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
                  🔴 صورتا الهوية مطلوبتان
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Front Photo Card */}
              <div className="border border-slate-800/90 rounded-xl p-2 bg-slate-950/80 text-center flex flex-col justify-between min-h-[135px]">
                <span className="text-[11px] font-bold text-slate-300 block mb-1">الوجه الأمامي</span>
                {senderIdPhotoUrl ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/40 bg-black flex-1 flex items-center justify-center">
                    <PhotoFromIndexedDB photoKey={senderIdPhotoUrl} alt="الهوية الأمامية" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setSenderIdPhotoUrl('')}
                      className="absolute top-1 left-1 p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-md transition-colors cursor-pointer"
                      title="حذف وإعادة الالتقاط"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-amber-400/5 hover:bg-amber-400/10 cursor-pointer active:scale-[0.98] transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageCapture(e, setSenderIdPhotoUrl, 'sender_front')}
                      className="hidden"
                    />
                    <Camera className="w-5 h-5 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-300">📷 صورة الأمامي</span>
                    <span className="text-[9px] text-slate-400">كاميرا أو المعرض</span>
                  </label>
                )}
              </div>

              {/* Back Photo Card */}
              <div className="border border-slate-800/90 rounded-xl p-2 bg-slate-950/80 text-center flex flex-col justify-between min-h-[135px]">
                <span className="text-[11px] font-bold text-slate-300 block mb-1">الوجه الخلفي</span>
                {senderIdBackPhotoUrl ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/40 bg-black flex-1 flex items-center justify-center">
                    <PhotoFromIndexedDB photoKey={senderIdBackPhotoUrl} alt="الهوية الخلفية" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setSenderIdBackPhotoUrl('')}
                      className="absolute top-1 left-1 p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-md transition-colors cursor-pointer"
                      title="حذف وإعادة الالتقاط"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-amber-400/5 hover:bg-amber-400/10 cursor-pointer active:scale-[0.98] transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageCapture(e, setSenderIdBackPhotoUrl, 'sender_back')}
                      className="hidden"
                    />
                    <Camera className="w-5 h-5 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-300">📷 صورة الخلفي</span>
                    <span className="text-[9px] text-slate-400">كاميرا أو المعرض</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 2. SENDER ACCORDION SECTION                                           */}
          {/* ===================================================================== */}
          <div className={`bg-slate-900/70 backdrop-blur-md border rounded-2xl transition-all duration-200 ease-out shadow-sm ${
            !isSenderOpen && senderErrorsCount > 0 ? 'border-rose-500/60' : 'border-slate-800/80'
          }`}>
            <button
              type="button"
              aria-expanded={isSenderOpen}
              onClick={() => setIsSenderOpen(!isSenderOpen)}
              className="w-full p-3 flex items-center justify-between cursor-pointer text-right hover:bg-slate-800/30 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-200 tracking-wide">2. بيانات المرسل الرسمية</span>
              </div>
              <div className="flex items-center gap-2">
                {!isSenderOpen && senderErrorsCount > 0 && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold animate-in fade-in">
                    ⚠️ {senderErrorsCount} حقول ناقصة
                  </span>
                )}
                {!isSenderOpen && senderErrorsCount === 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3" /> مكتمل
                  </span>
                )}
                <div className="transition-transform duration-200">
                  {isSenderOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
            </button>

            {isSenderOpen && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 mt-1 animate-in fade-in duration-150">
                {/* Customer Directory Button + Selected Customer Badge */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomerDirectoryOpen(true)}
                    className="h-8 px-2.5 bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-700 hover:border-cyan-500 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                    title="فتح دليل العملاء والتجار المعتمدين"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>دليل العملاء</span>
                  </button>

                  {selectedCustomerId ? (
                    <div className="flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-500/60 rounded-lg px-2 py-1 text-[11px] text-cyan-300 font-bold truncate max-w-[210px] sm:max-w-xs animate-in fade-in">
                      <span className="truncate">✓ مستدعى: {senderName || `${senderFirstName} ${senderLastName}`.trim()}</span>
                      <button
                        type="button"
                        onClick={handleClearCustomer}
                        className="text-slate-400 hover:text-rose-400 p-0.5 rounded cursor-pointer ml-1"
                        title="إلغاء ربط العميل وتفريغ الحقول"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">اختر من الدليل لملء الحقول فوراً</span>
                  )}
                </div>

                {/* الاسم الأول - اسم الأب - الكنية */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      الاسم الأول: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderFirstName}
                      onChange={(e) => handleSenderFirstNameChange(e.target.value)}
                      placeholder="الاسم"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      اسم الأب: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderFatherName}
                      onChange={(e) => handleSenderFatherNameChange(e.target.value)}
                      placeholder="الأب"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      الكنية: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderLastName}
                      onChange={(e) => handleSenderLastNameChange(e.target.value)}
                      placeholder="الكنية"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    />
                  </div>
                </div>

                {/* اسم الأم وتاريخ الولادة */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      اسم الأم: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderMotherName}
                      onChange={(e) => setSenderMotherName(e.target.value)}
                      placeholder="اسم الأم"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      تاريخ الولادة: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={senderBirthDate}
                      onChange={(e) => setSenderBirthDate(e.target.value)}
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none transition-all duration-150"
                    />
                  </div>
                </div>

                {/* الرقم الوطني ونوع الوثيقة */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      الرقم الوطني (11 رقماً): <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderNationalId}
                      onChange={(e) => handleSenderNationalIdChange(e.target.value)}
                      placeholder="01010123456"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">نوع الوثيقة:</label>
                    <select
                      value={senderIdType}
                      onChange={(e) => setSenderIdType(e.target.value)}
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none transition-all duration-150"
                    >
                      {idDocumentTypes.map((t, idx) => (
                        <option key={idx} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* رقم الهاتف مع البحث التلقائي */}
                <div className="relative">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    رقم هاتف المرسل: <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="tel"
                      value={senderPhone}
                      onChange={(e) => handleSenderPhoneChange(e.target.value)}
                      placeholder="09XXXXXXXX"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                      dir="ltr"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                  </div>

                  {showSenderSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-slate-900 border-2 border-amber-400/40 rounded-xl shadow-2xl p-1.5 mt-1 space-y-1 backdrop-blur-lg animate-in fade-in duration-150">
                      <span className="text-[9.5px] text-amber-300 font-bold block px-1.5">عملاء مسجلون بدليل العملاء:</span>
                      {customerSuggestions.map((cust, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectCustomer(cust)}
                          className="w-full text-right p-2 rounded-lg hover:bg-slate-800/80 text-xs text-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-bold text-white block">{cust.fullName}</span>
                            {cust.nationalId && <span className="text-[9.5px] text-slate-400 font-mono">وطني: {cust.nationalId}</span>}
                          </div>
                          <span className="font-mono text-[10px] text-amber-300 font-bold">{cust.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCustomerId && (
                    <div className="text-[9.5px] text-emerald-400 font-bold flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-lg mt-1 animate-in fade-in">
                      <span>✓ تم ربط العميل المسجل بالدليل</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(null)}
                        className="text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        تغيير
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 3. RECEIVER ACCORDION SECTION                                         */}
          {/* ===================================================================== */}
          <div className={`bg-slate-900/70 backdrop-blur-md border rounded-2xl transition-all duration-200 ease-out shadow-sm ${
            !isReceiverOpen && receiverErrorsCount > 0 ? 'border-rose-500/60' : 'border-slate-800/80'
          }`}>
            <button
              type="button"
              aria-expanded={isReceiverOpen}
              onClick={() => setIsReceiverOpen(!isReceiverOpen)}
              className="w-full p-3 flex items-center justify-between cursor-pointer text-right hover:bg-slate-800/30 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-sky-400/15 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black text-slate-200 tracking-wide">3. بيانات المستلم والوجهة</span>
              </div>
              <div className="flex items-center gap-2">
                {!isReceiverOpen && receiverErrorsCount > 0 && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold animate-in fade-in">
                    ⚠️ {receiverErrorsCount} حقول ناقصة
                  </span>
                )}
                {!isReceiverOpen && receiverErrorsCount === 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3" /> مكتمل
                  </span>
                )}
                <div className="transition-transform duration-200">
                  {isReceiverOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
            </button>

            {isReceiverOpen && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 mt-1 animate-in fade-in duration-150">
                {/* فرع الوجهة */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    فرع / مركز الوجهة المستلمة: <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={destHubId}
                    onChange={(e) => setDestHubId(e.target.value)}
                    disabled={destinationBranches.length === 0}
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-sky-400 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-white font-bold disabled:opacity-50 focus:outline-none transition-all duration-150"
                  >
                    {destinationBranches.length === 0 ? (
                      <option value="">لا توجد فروع أخرى مسجلة</option>
                    ) : (
                      <>
                        <option value="">-- اختر فرع / مركز الوجهة المستلمة --</option>
                        {destinationBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} (محافظة {b.governorate})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                {/* اسم وهاتف المستلم */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      اسم المستلم الكامل: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="اسم المستلم"
                      required
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      رقم هاتف المستلم: <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="tel"
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(sanitizePhone(e.target.value))}
                        placeholder="09XXXXXXXX"
                        required
                        className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                        dir="ltr"
                      />
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* عنوان التسليم بالتفصيل */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    عنوان التسليم بالتفصيل: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiverAddress}
                    onChange={(e) => setReceiverAddress(e.target.value)}
                    placeholder="المنطقة، الحي، الشارع، أو علامة مميزة"
                    required
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 4. PACKAGE SPECS ACCORDION SECTION (COLLAPSED BY DEFAULT)             */}
          {/* ===================================================================== */}
          <div className={`bg-slate-900/70 backdrop-blur-md border rounded-2xl transition-all duration-200 ease-out shadow-sm ${
            !isPackageOpen && packageErrorsCount > 0 ? 'border-rose-500/60' : 'border-slate-800/80'
          }`}>
            <button
              type="button"
              aria-expanded={isPackageOpen}
              onClick={() => setIsPackageOpen(!isPackageOpen)}
              className="w-full p-3 flex items-center justify-between cursor-pointer text-right hover:bg-slate-800/30 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-yellow-400/15 border border-yellow-400/30 text-yellow-400 flex items-center justify-center">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-200 tracking-wide block">4. مواصفات الطرد والشحنة</span>
                  {!isPackageOpen && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {shippingCategory === 'postal' ? 'بريدي' : 'بضائع'} • {piecesCount} قطع • {weightKg} كغ
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isPackageOpen && packageErrorsCount > 0 && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold animate-in fade-in">
                    ⚠️ {packageErrorsCount}
                  </span>
                )}
                <div className="transition-transform duration-200">
                  {isPackageOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
            </button>

            {isPackageOpen && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 mt-1 animate-in fade-in duration-150">
                {/* Category & Type */}
                <div className="grid grid-cols-2 gap-1.5 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">تصنيف الشحن:</label>
                    <select
                      value={shippingCategory}
                      onChange={(e) => setShippingCategory(e.target.value as ShippingCategory)}
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none transition-all duration-150"
                    >
                      <option value="postal">بريدي (Postal)</option>
                      <option value="cargo">شحن بضائع (Cargo)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">نوع الطرد:</label>
                    <select
                      value={packageType}
                      onChange={(e) => setPackageType(e.target.value)}
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 rounded-xl px-2 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none transition-all duration-150"
                    >
                      {packageTypes.map((t, idx) => (
                        <option key={idx} value={t}>
                          {t}{getRateLabel(t)}
                        </option>
                      ))}
                    </select>
                    {/* Detail hint for applied rate */}
                    {(() => {
                      const rates = brandingSettings.packageTypeRates?.[packageType];
                      if (!rates) return null;
                      if (rates.fixedPriceSyp && rates.fixedPriceSyp > 0) {
                        return (
                          <span className="text-[9.5px] text-emerald-400 font-bold block mt-1">
                            🏷️ أجور مثبتة لهذا النوع: {formatCurrency(rates.fixedPriceSyp, 'SYP')}
                          </span>
                        );
                      }
                      if (rates.minPriceSyp && rates.minPriceSyp > 0) {
                        return (
                          <span className="text-[9.5px] text-amber-400 font-bold block mt-1">
                            ⛔ الحد الأدنى للتعديل: {formatCurrency(rates.minPriceSyp, 'SYP')}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Pieces & Weight */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">عدد القطع:</label>
                    <input
                      type="number"
                      min="1"
                      value={piecesCount}
                      onChange={(e) => setPiecesCount(e.target.value)}
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      الوزن (كغ): <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none transition-all duration-150"
                    />
                  </div>
                </div>

                {/* Content Description */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    وصف محتوى الشحنة: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={contentDescription}
                    onChange={(e) => setContentDescription(e.target.value)}
                    placeholder="ألبسة، أدوات كهربائية، وثائق، قطع غيار..."
                    required
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 5. FINANCIALS ACCORDION SECTION (COLLAPSED BY DEFAULT)                */}
          {/* ===================================================================== */}
          <div className={`bg-slate-900/70 backdrop-blur-md border rounded-2xl transition-all duration-200 ease-out shadow-sm ${
            !isFinancialOpen && financialErrorsCount > 0 ? 'border-rose-500/60' : 'border-slate-800/80'
          }`}>
            <button
              type="button"
              aria-expanded={isFinancialOpen}
              onClick={() => setIsFinancialOpen(!isFinancialOpen)}
              className="w-full p-3 flex items-center justify-between cursor-pointer text-right hover:bg-slate-800/30 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-200 tracking-wide block">5. البيانات المالية ومحرك التسعير</span>
                  {!isFinancialOpen && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {paymentType === 'collect' ? 'على المستلم' : paymentType === 'prepaid' ? 'مدفوع سلفاً' : 'ضد الدفع COD'} • {formatCurrency(calculatedTotalDue, currency)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isFinancialOpen && financialErrorsCount > 0 && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold animate-in fade-in">
                    ⚠️ {financialErrorsCount}
                  </span>
                )}
                <div className="transition-transform duration-200">
                  {isFinancialOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
            </button>

            {isFinancialOpen && (
              <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 mt-1 animate-in fade-in duration-150">
                {/* Currency & Payment Type */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300">طريقة الدفع:</label>
                    <div className="flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCurrency('SYP')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          currency === 'SYP' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'
                        }`}
                      >
                        ل.س
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          currency === 'USD' ? 'bg-emerald-400 text-slate-950 font-black' : 'text-slate-400'
                        }`}
                      >
                        USD
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentType('collect')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                        paymentType === 'collect'
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      على المستلم
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('prepaid')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                        paymentType === 'prepaid'
                          ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-black shadow-sm'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      مدفوع سلفاً
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('cod')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                        paymentType === 'cod'
                          ? 'bg-sky-400 text-slate-950 border-sky-300 font-black shadow-sm'
                          : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      ضد الدفع (COD)
                    </button>
                  </div>
                </div>

                {/* Shipping Cost Input with Override */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      أجور الشحن ({currency}): <span className="text-rose-400">*</span>
                    </label>
                    {isManualShippingCostOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualShippingCostOverride(false);
                          setShippingCost(pricingEngineResult.shippingCost);
                        }}
                        className="text-[10px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>استعادة تسعيرة المحرك</span>
                      </button>
                    )}
                  </div>
                  <FormattedAmountInput
                    value={shippingCost}
                    onChange={(num) => {
                      setShippingCost(num);
                      setIsManualShippingCostOverride(true);
                    }}
                    currency={currency}
                    placeholder="أجور الشحن"
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white focus:outline-none transition-all duration-150"
                  />
                </div>

                {/* COD Amount & Distribution if selected */}
                {paymentType === 'cod' && (
                  <div className="bg-slate-950/90 p-2.5 rounded-xl border border-sky-400/40 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-sky-300 block">
                        قيمة البضاعة للزبون (ضد الدفع COD): <span className="text-rose-400">*</span>
                      </label>
                      {/* Remittance Currency Selector */}
                      <div className="flex bg-slate-900 rounded-lg p-0.5 border border-sky-500/40">
                        <button
                          type="button"
                          onClick={() => setCodCurrency('SYP')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            codCurrency === 'SYP'
                              ? 'bg-sky-400 text-slate-950 font-black shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ل.س
                        </button>
                        <button
                          type="button"
                          onClick={() => setCodCurrency('USD')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            codCurrency === 'USD'
                              ? 'bg-sky-400 text-slate-950 font-black shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          دولار ($)
                        </button>
                      </div>
                    </div>

                    <FormattedAmountInput
                      value={codAmount}
                      onChange={(num) => setCodAmount(num)}
                      currency={codCurrency}
                      placeholder={`مبلغ التحصيل بـ (${codCurrency === 'SYP' ? 'ل.س' : '$'})`}
                      className={`w-full h-10 bg-slate-900 border rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-black focus:outline-none transition-all duration-150 ${
                        (!codAmount || Number(codAmount) <= 0) || (pricingEngineResult?.maxCodAmount && Number(codAmount) > pricingEngineResult.maxCodAmount)
                          ? 'border-rose-500 text-rose-300 ring-1 ring-rose-500'
                          : 'border-sky-400/40 text-sky-300'
                      }`}
                    />

                    {(!codAmount || Number(codAmount) <= 0) && (
                      <div className="text-[10px] text-rose-400 flex items-center gap-1 font-bold animate-pulse">
                        <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>شرط إلزامي: يجب تسجيل مبلغ الحوالة (أكبر من 0) (*)</span>
                      </div>
                    )}

                    {pricingEngineResult?.maxCodAmount && Number(codAmount) > pricingEngineResult.maxCodAmount && (
                      <div className="text-[10px] text-rose-400 flex items-center gap-1 font-bold animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>يتجاوز السقف الأعلى المسموح به للحوالة ({formatCurrency(pricingEngineResult.maxCodAmount, codCurrency)})</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>عمولة التحصيل:</span>
                      <span className="font-mono font-bold text-sky-300">
                        {formatCurrency(calculatedCodTransferFee, codCurrency)}
                      </span>
                    </div>

                    {/* Button Toggle: توزيع أجور الشحن (على المستلم أو على المرسل) */}
                    <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg p-2 space-y-1.5 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                          <span>توزيع أجور الشحن:</span>
                        </span>
                        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-700">
                          <button
                            type="button"
                            onClick={() => setCodShippingPayer('recipient')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              codShippingPayer === 'recipient'
                                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>التلقائي (على المستلم)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCodShippingPayer('sender')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              codShippingPayer === 'sender'
                                ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>أجور الشحن على المرسل</span>
                          </button>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {codShippingPayer === 'sender'
                          ? '✓ أجور الشحن تسدد من المرسل سلفاً، والمطلوب من المستلم فقط مبلغ الحوالة وعمولتها.'
                          : '✓ التلقائي: المستلم يسدد كامل المبالغ (أجور الشحن + مبلغ الحوالة + عمولة الحوالة).'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Financial Summary Breakdown (Unified Presentation) */}
                <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-300 text-[11px]">
                    <span className="text-slate-400">
                      أجور الشحن {paymentType === 'cod' && codShippingPayer === 'sender' ? '(مسددة من المرسل):' : paymentType === 'prepaid' ? '(مدفوعة سلفاً):' : '(على المستلم):'}
                    </span>
                    <span className="font-bold text-white">
                      {formatCurrency(Number(shippingCost) || 0, currency)}
                    </span>
                  </div>
                  {paymentType === 'cod' && (
                    <>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">مبلغ الحوالة المحصل للمرسل:</span>
                        <span className="font-bold text-sky-400">{formatCurrency(Number(codAmount) || 0, codCurrency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">عمولة التحويل:</span>
                        <span className="font-bold text-sky-300">{formatCurrency(calculatedCodTransferFee, codCurrency)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t border-slate-800 pt-1.5 mt-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400">المطلوب تحصيله من المستلم:</span>
                    <span className="text-sm font-black text-emerald-300">
                      {financialSummary.isMultiCurrency
                        ? `${formatCurrency(financialSummary.totalDueFromReceiver, codCurrency)} (+ ${formatCurrency(Number(shippingCost) || 0, currency)} شحن)`
                        : formatCurrency(financialSummary.totalDueFromReceiver, currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* 6. EXTRA OPTIONS ACCORDION (COLLAPSED BY DEFAULT)                     */}
          {/* ===================================================================== */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl transition-all duration-200 ease-out">
            <button
              type="button"
              aria-expanded={isExtraOpen}
              onClick={() => setIsExtraOpen(!isExtraOpen)}
              className="w-full p-2.5 flex items-center justify-between cursor-pointer text-right text-slate-400 hover:text-slate-200 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold">6. خيارات إضافية (ملاحظات، باركود ورقي)</span>
                {hasExtraData && (
                  <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded font-bold animate-in fade-in">
                    مدخل
                  </span>
                )}
              </div>
              <div className="transition-transform duration-200">
                {isExtraOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {isExtraOpen && (
              <div className="p-3 pt-0 space-y-2 border-t border-slate-800/60 mt-1 animate-in fade-in duration-150">
                <div className="pt-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">ملاحظات الشحنة:</label>
                  <input
                    type="text"
                    value={packageNotes}
                    onChange={(e) => setPackageNotes(e.target.value)}
                    placeholder="تعليمات مناولة، طرد قابل للكسر..."
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">رقم الوصل الورقي / الباركود:</label>
                  <input
                    type="text"
                    value={paperReceiptNumber}
                    onChange={(e) => setPaperReceiptNumber(e.target.value)}
                    placeholder="اتركه فارغاً للتوليد التلقائي"
                    className="w-full h-10 bg-slate-950/80 border border-slate-800 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-500 focus:outline-none transition-all duration-150"
                    dir="ltr"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* FIXED STICKY ACTION FOOTER (FLOATING BOTTOM BAR)                      */}
          {/* ===================================================================== */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 px-3.5 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
              <div>
                <span className="text-[9.5px] text-slate-400 block font-bold">المستحق تحصيله:</span>
                <span className="font-mono text-sm sm:text-base font-black text-emerald-300">
                  {formatCurrency(calculatedTotalDue, currency)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 hover:scale-[1.01] active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-400/20 transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري الحفظ والطباعة...</span>
                  </div>
                ) : (
                  <>
                    <Printer className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {totalErrorsCount > 0
                        ? `حفظ وطباعة البوليصة (${totalErrorsCount} متبقي)`
                        : 'حفظ وطباعة البوليصة'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* DIRECT BLUETOOTH THERMAL RECEIPT MODAL                                    */}
      {/* ========================================================================= */}
      <CourierThermalReceiptModal
        parcel={registeredParcelSuccess}
        isOpen={showThermalReceiptModal}
        onClose={() => {
          setShowThermalReceiptModal(false);
          setAutoTriggerBluetooth(false);
        }}
        autoConnectBluetooth={autoTriggerBluetooth}
      />

      {/* ========================================================================= */}
      {/* OFFLINE CLIENT-SIDE ID OCR SCANNER MODAL                                  */}
      {/* ========================================================================= */}
      <IdOcrScannerModal
        isOpen={showOcrScanner}
        onClose={() => setShowOcrScanner(false)}
        onApplyExtractedData={handleOcrDataExtracted}
      />

      {/* ========================================================================= */}
      {/* CUSTOMER DIRECTORY MODAL FOR SENDER PICKER                                */}
      {/* ========================================================================= */}
      <CustomerDirectoryModal
        isOpen={isCustomerDirectoryOpen}
        onClose={() => setIsCustomerDirectoryOpen(false)}
        onSelectCustomer={handleSelectCustomerFromDirectory}
        mode="picker"
      />

    </div>
  );
};
