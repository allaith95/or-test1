import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  X,
  Coins,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  Phone,
  Building,
  Calendar,
  Clock,
  Printer,
  FileText,
  MessageSquare,
  Check,
  ArrowRight,
  Receipt,
  Search,
  RefreshCw,
  Copy,
  Wallet,
  HandCoins,
  MapPin,
  Lock,
  ShieldCheck,
  QrCode,
  Scan,
  ListOrdered,
  ArrowLeft,
  Eye,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Currency, Parcel } from '../types';
import {
  processHoneywellRawBarcode,
  ExtractedSmartIdFields,
  extractCleanTrackingQuery,
} from '../utils/BarcodeScannerUtility';
import {
  verifySenderIdentity,
  SenderVerificationResult,
  normalizeNid,
} from '../utils/senderVerification';
import { phonesMatch } from '../utils/phoneUtils';

interface CodSenderPayoutModalProps {
  isOpen?: boolean;
  parcelId?: string | null;
  onClose?: () => void;
  onSuccess?: (voucherId?: string) => void;
}

// Convert Eastern Arabic numbers to Latin digits
const toLatinDigits = (str: string): string => {
  if (!str) return '';
  const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(eastern[i], i.toString());
  }
  return res.replace(/[^0-9.]/g, '');
};

const formatEnNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '0';
  const val = typeof num === 'number' ? num : parseFloat(String(num));
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('en-US').format(val);
};

const formatEnCurrency = (amount: number, currency: Currency): string => {
  const formatted = formatEnNumber(amount);
  return currency === 'USD' ? `$${formatted} USD` : `${formatted} SYP`;
};

const formatEnDateTime = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

export const CodSenderPayoutModal: React.FC<CodSenderPayoutModalProps> = ({
  isOpen,
  parcelId,
  onClose,
  onSuccess,
}) => {
  const {
    parcels,
    branches,
    customers,
    currentBranch,
    currentUser,
    payoutCodToSender,
    notifySenderForCodPayout,
    openCodPayoutReceipt,
    isCodSenderPayoutModalOpen,
    selectedCodPayoutParcelId,
    closeCodSenderPayoutModal,
  } = useOrca();

  const effectiveIsOpen = isOpen !== undefined ? isOpen : isCodSenderPayoutModalOpen;
  const effectiveParcelId = parcelId !== undefined ? parcelId : selectedCodPayoutParcelId;

  // Search by Receipt Number / Tracking Number State
  const [receiptSearchNumber, setReceiptSearchNumber] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Active matched parcel
  const [matchedParcel, setMatchedParcel] = useState<Parcel | null>(null);

  // Identity Verification Mode: 'scanner' | 'manual'
  const [verificationMethod, setVerificationMethod] = useState<'scanner' | 'manual'>('scanner');

  // Super Admin specific state
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [adminTab, setAdminTab] = useState<'list' | 'payout_form'>('list');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminBranchFilter, setAdminBranchFilter] = useState('all');
  const [adminCurrencyFilter, setAdminCurrencyFilter] = useState<'all' | 'SYP' | 'USD'>('all');
  const [adminSmsFilter, setAdminSmsFilter] = useState<'all' | 'notified' | 'pending_notice'>('all');

  // Scanner State
  const [scannerRawInput, setScannerRawInput] = useState('');
  const [scannerDecodedData, setScannerDecodedData] = useState<ExtractedSmartIdFields | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);

  // Layer 2: 3 Mandatory Verification Input Fields
  const [recipientNationalId, setRecipientNationalId] = useState('');
  const [recipientMotherName, setRecipientMotherName] = useState('');
  const [recipientBirthDate, setRecipientBirthDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [notes, setNotes] = useState('');

  // Verification result state
  const [verificationResult, setVerificationResult] = useState<SenderVerificationResult | null>(null);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notificationSentMessage, setNotificationSentMessage] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Success state after saving
  const [recentPayoutSuccess, setRecentPayoutSuccess] = useState<{
    voucherId?: string;
    voucherNumber?: string;
    recipientName: string;
    amount: number;
    currency: Currency;
    trackingNumber: string;
    parcel: any;
    timestamp: string;
  } | null>(null);

  // Check user authorization
  const isAuthorizedRole = useMemo(() => {
    const allowedRoles = [
      'super_admin',
      'hub_manager',
      'branch_manager',
      'accountant',
      'cashier',
      'outbound_operator',
      'operations',
      'admin',
    ];
    return allowedRoles.includes(currentUser?.role || '');
  }, [currentUser?.role]);

  // Compute all COD parcels that are collected across the whole system
  const allReadyCodParcels = useMemo(() => {
    return parcels.filter((p) => {
      const isCod = p.paymentType === 'cod' && (p.codAmount || 0) > 0;
      const isDeliveredOrCollected =
        p.handlingStatus === 'delivered' ||
        p.cashierCollected === true ||
        p.codStatus === 'collected_awaiting_sender_payout' ||
        p.codStatus === 'sender_notified' ||
        p.codPaidToSender === true;
      return isCod && isDeliveredOrCollected;
    });
  }, [parcels]);

  // Filtered COD list specifically for Super Admin dashboard
  const filteredAdminCodList = useMemo(() => {
    if (!isSuperAdmin) return [];
    return allReadyCodParcels.filter((p) => {
      // 1. Branch filter
      if (adminBranchFilter !== 'all') {
        const pBranch = p.originHubId || p.originBranchId;
        if (pBranch !== adminBranchFilter) return false;
      }

      // 2. Currency filter
      if (adminCurrencyFilter !== 'all') {
        const cur = p.codCurrency || (p.codAmount > 1000 ? 'SYP' : p.currency || 'SYP');
        if (cur !== adminCurrencyFilter) return false;
      }

      // 3. SMS notification filter
      if (adminSmsFilter === 'notified' && p.codStatus !== 'sender_notified' && !p.codSenderNotifiedAt) {
        return false;
      }
      if (adminSmsFilter === 'pending_notice' && (p.codStatus === 'sender_notified' || p.codSenderNotifiedAt)) {
        return false;
      }

      // 4. Search query
      if (adminSearchQuery.trim()) {
        const cleanQ = adminSearchQuery.toLowerCase().trim();
        const cleanNums = toLatinDigits(cleanQ);
        const cleanExtracted = extractCleanTrackingQuery(cleanQ).toLowerCase();

        const matchTrack =
          p.trackingNumber?.toLowerCase().includes(cleanQ) ||
          (cleanExtracted && p.trackingNumber?.toLowerCase().includes(cleanExtracted)) ||
          (cleanNums && p.trackingNumber?.includes(cleanNums));

        const matchReceipt =
          (p.paperReceiptNumber && p.paperReceiptNumber.toLowerCase().includes(cleanQ)) ||
          (p.paperReceiptNumber && cleanExtracted && p.paperReceiptNumber.toLowerCase().includes(cleanExtracted)) ||
          (p.paperReceiptNumber && cleanNums && p.paperReceiptNumber.includes(cleanNums));

        const matchSender =
          p.sender?.name?.toLowerCase().includes(cleanQ) ||
          p.sender?.phone?.includes(cleanNums || cleanQ) ||
          (p.sender?.nationalId && p.sender.nationalId.includes(cleanNums || cleanQ));

        const matchReceiver =
          p.receiver?.name?.toLowerCase().includes(cleanQ) ||
          p.receiver?.phone?.includes(cleanNums || cleanQ);

        const matchId = p.id === cleanQ || p.id === cleanExtracted;

        return matchTrack || matchReceipt || matchSender || matchReceiver || matchId;
      }

      return true;
    });
  }, [allReadyCodParcels, isSuperAdmin, adminBranchFilter, adminCurrencyFilter, adminSmsFilter, adminSearchQuery]);

  // Aggregate metrics for Super Admin
  const totalSypAmount = useMemo(() => {
    return allReadyCodParcels
      .filter((p) => (p.codCurrency || (p.codAmount > 1000 ? 'SYP' : p.currency || 'SYP')) === 'SYP')
      .reduce((sum, p) => sum + (p.codAmount || 0), 0);
  }, [allReadyCodParcels]);

  const totalUsdAmount = useMemo(() => {
    return allReadyCodParcels
      .filter((p) => (p.codCurrency || (p.codAmount <= 1000 ? p.currency : 'SYP')) === 'USD')
      .reduce((sum, p) => sum + (p.codAmount || 0), 0);
  }, [allReadyCodParcels]);

  const totalNotifiedCount = useMemo(() => {
    return allReadyCodParcels.filter((p) => p.codStatus === 'sender_notified' || p.codSenderNotifiedAt).length;
  }, [allReadyCodParcels]);

  // Handle open modal & initial search state
  useEffect(() => {
    if (effectiveIsOpen) {
      setErrorMessage(null);
      setNotificationSentMessage(null);
      setRecentPayoutSuccess(null);

      if (effectiveParcelId && effectiveParcelId.trim() !== '') {
        const p = parcels.find((item) => item.id === effectiveParcelId);
        if (p) {
          const query = p.paperReceiptNumber || p.trackingNumber;
          setReceiptSearchNumber(query);
          handlePerformSearch(query);
          if (isSuperAdmin) {
            setAdminTab('payout_form');
          }
        }
      } else {
        setReceiptSearchNumber('');
        setSearchedQuery('');
        setHasSearched(false);
        setMatchedParcel(null);
        if (isSuperAdmin) {
          setAdminTab('list');
        }
      }
    } else {
      setReceiptSearchNumber('');
      setSearchedQuery('');
      setHasSearched(false);
      setMatchedParcel(null);
      resetIdVerificationFields();
    }
  }, [effectiveIsOpen, effectiveParcelId, isSuperAdmin]);

  // Select a parcel from Admin List to proceed with ID Verification & Payout
  const handleSelectParcelForPayout = (p: Parcel) => {
    setMatchedParcel(p);
    const q = p.paperReceiptNumber || p.trackingNumber;
    setReceiptSearchNumber(q);
    setSearchedQuery(q);
    setHasSearched(true);
    setAdminTab('payout_form');
    resetIdVerificationFields();
  };

  // Reset ID fields
  const resetIdVerificationFields = () => {
    setScannerRawInput('');
    setScannerDecodedData(null);
    setRecipientNationalId('');
    setRecipientMotherName('');
    setRecipientBirthDate('');
    setVerificationResult(null);
    setNotes('');
  };

  // Perform search by paper receipt number or tracking number
  const handlePerformSearch = (customQuery?: string) => {
    const rawQuery = (customQuery !== undefined ? customQuery : receiptSearchNumber).trim();
    if (!rawQuery) {
      setErrorMessage('يرجى إدخال رقم الإيصال الورقي أو رقم البوليصة للبحث.');
      return;
    }

    setErrorMessage(null);
    setSearchedQuery(rawQuery);
    setHasSearched(true);
    setRecentPayoutSuccess(null);
    resetIdVerificationFields();

    const cleanQ = rawQuery.toLowerCase();
    const cleanNumbersOnly = toLatinDigits(rawQuery);
    const cleanExtracted = extractCleanTrackingQuery(rawQuery).toLowerCase();

    // Search in parcels
    const found = parcels.find((p) => {
      const matchTracking =
        p.trackingNumber?.toLowerCase() === cleanQ ||
        (cleanExtracted && p.trackingNumber?.toLowerCase() === cleanExtracted) ||
        (cleanNumbersOnly && p.trackingNumber?.includes(cleanNumbersOnly));

      const matchReceipt =
        (p.paperReceiptNumber && p.paperReceiptNumber.toLowerCase() === cleanQ) ||
        (p.paperReceiptNumber && cleanExtracted && p.paperReceiptNumber.toLowerCase() === cleanExtracted) ||
        (p.paperReceiptNumber && cleanNumbersOnly && p.paperReceiptNumber.includes(cleanNumbersOnly));

      const matchId = p.id === rawQuery || p.id === cleanExtracted;
      return matchTracking || matchReceipt || matchId;
    });

    if (found) {
      setMatchedParcel(found);
    } else {
      setMatchedParcel(null);
    }
  };

  // Look up sender's registered National ID (from parcel or fallback to customers directory)
  const registeredSenderData = useMemo(() => {
    if (!matchedParcel) return { nationalId: '', motherName: '', birthDate: '', phone: '', source: 'none' };
    const pSender = matchedParcel.sender || ({} as any);
    let nid = normalizeNid(pSender.nationalId || '');
    let mother = String(pSender.motherName || '').trim();
    let birth = String(pSender.birthDate || '').trim();
    let phone = String(pSender.phone || '').trim();
    let source: 'parcel' | 'customer' | 'none' = nid ? 'parcel' : 'none';

    if (!nid && phone) {
      const c = (customers || []).find(
        (cust) =>
          cust &&
          cust.phone &&
          (normalizeNid(cust.phone) === normalizeNid(phone) || phonesMatch(cust.phone, phone))
      );
      if (c) {
        nid = normalizeNid(c.nationalId || '');
        if (!mother) mother = String(c.motherName || '').trim();
        if (!birth) birth = String(c.birthDate || '').trim();
        source = 'customer';
      }
    }

    return { nationalId: nid, motherName: mother, birthDate: birth, phone, source };
  }, [matchedParcel, customers]);

  // Masked NID for Layer 1 Read-Only display
  const maskedSenderNationalId = useMemo(() => {
    if (!registeredSenderData.nationalId) return 'غير مسجل بالبوليصة';
    const nid = registeredSenderData.nationalId;
    if (nid.length <= 4) return `****${nid}`;
    return `****${nid.slice(-4)}`;
  }, [registeredSenderData.nationalId]);

  // Check if matched parcel is ready for payout
  const payoutReadiness = useMemo(() => {
    if (!matchedParcel) return null;

    const isOrigin =
      isSuperAdmin ||
      matchedParcel.originHubId === currentBranch?.id ||
      matchedParcel.originBranchId === currentBranch?.id;
    const isCod = matchedParcel.paymentType === 'cod' && (matchedParcel.codAmount || 0) > 0;
    const isDeliveredOrCollected =
      matchedParcel.handlingStatus === 'delivered' ||
      matchedParcel.cashierCollected === true ||
      matchedParcel.codStatus === 'collected_awaiting_sender_payout';
    const isAlreadyPaid = Boolean(matchedParcel.codPaidToSender || matchedParcel.codStatus === 'paid_to_sender');

    let canPay = false;
    let reasonText = '';
    let statusType: 'ready' | 'already_paid' | 'not_collected' | 'not_cod' | 'branch_mismatch' = 'ready';

    if (isAlreadyPaid) {
      statusType = 'already_paid';
      reasonText = `تم صرف وتسليم هذه الحوالة مسبقاً بموجب السند رقم [${matchedParcel.codSenderPayoutVoucherNumber || 'PV-COD'}].`;
    } else if (!isOrigin) {
      const origB = branches.find((b) => b.id === matchedParcel.originHubId || b.id === matchedParcel.originBranchId);
      statusType = 'branch_mismatch';
      reasonText = `هذه الحوالة تابعة حصراً لفرع الصادر (${origB?.name || matchedParcel.originHubId}) ولا يمكن صرفها من فرع آخر.`;
    } else if (!isCod) {
      statusType = 'not_cod';
      reasonText = 'هذه الشحنة ليست شحنة ضد الدفع (COD).';
    } else if (!isDeliveredOrCollected) {
      statusType = 'not_collected';
      reasonText = `الشحنة لم تُسلّم بعد ولم يُحصّل مبلغها في فرع الوجهة. (الحالة الحالية: ${matchedParcel.handlingStatus}).`;
    } else {
      canPay = true;
      statusType = 'ready';
      reasonText = 'الحوالة مطابقة وجاهزة للتسليم والصرف للمرسل بعد التحقق من الهوية.';
    }

    return {
      canPay,
      statusType,
      reasonText,
    };
  }, [matchedParcel, currentBranch?.id, branches, isSuperAdmin]);

  // Execute Identity Verification (Layer 2)
  const handleRunVerification = (customFields?: { nationalId: string; motherName: string; birthDate: string }) => {
    if (!matchedParcel) return;
    const toCheck = customFields || {
      nationalId: recipientNationalId,
      motherName: recipientMotherName,
      birthDate: recipientBirthDate,
    };

    const res = verifySenderIdentity(matchedParcel, toCheck, customers || []);
    setVerificationResult(res);
    if (!res.verified) {
      setErrorMessage(res.message);
    } else {
      setErrorMessage(null);
    }
  };

  // Handle Scanner Raw Barcode Input
  const handleScannerInputChange = (raw: string) => {
    setScannerRawInput(raw);
    if (!raw.trim()) return;

    // Process barcode with Syrian ID Barcode Decoder
    const decoded = processHoneywellRawBarcode(raw);
    if (decoded && (decoded.nationalId || decoded.firstName || decoded.lastName)) {
      setScannerDecodedData(decoded);
      const cleanNid = decoded.nationalId || '';
      const mName = decoded.motherName || '';
      const bDate = decoded.birthDateDisplay || decoded.birthDate || '';

      if (cleanNid) setRecipientNationalId(cleanNid);
      if (mName) setRecipientMotherName(mName);
      if (bDate) setRecipientBirthDate(bDate);
      setErrorMessage(null);

      // Auto-trigger verification if parcel is loaded
      if (matchedParcel && cleanNid) {
        handleRunVerification({
          nationalId: cleanNid,
          motherName: mName || recipientMotherName,
          birthDate: bDate || recipientBirthDate,
        });
      }
    }
  };

  // Test scan simulation for quick verification in testing
  const handleSimulateSyrianIdScan = () => {
    if (!matchedParcel) return;
    const simNid = registeredSenderData.nationalId || '01040589123';
    const simMother = registeredSenderData.motherName || 'فاطمة';
    const simBirth = registeredSenderData.birthDate || '1988-04-15';

    const sim: ExtractedSmartIdFields = {
      rawInput: 'SIMULATED_SYRIAN_ID_BARCODE',
      cleanedText: matchedParcel.sender?.name || 'مرسل',
      transliteratedText: matchedParcel.sender?.name || 'مرسل',
      nationalId: simNid,
      birthDate: simBirth,
      birthDateDisplay: simBirth,
      firstName: matchedParcel.sender?.name?.split(' ')[0] || 'مرسل',
      fatherName: 'أحمد',
      lastName: 'العلي',
      motherName: simMother,
      city: 'دمشق',
      idType: 'syrian',
      isValid: true,
    };

    setScannerDecodedData(sim);
    setRecipientNationalId(simNid);
    setRecipientMotherName(simMother);
    setRecipientBirthDate(simBirth);

    handleRunVerification({
      nationalId: simNid,
      motherName: simMother,
      birthDate: simBirth,
    });
  };

  // Handle Payout Confirmation
  const handleConfirmPayout = () => {
    if (!matchedParcel) {
      setErrorMessage('تنبيه: لم يتم تحديد أي حوالة للصرف.');
      return;
    }

    if (matchedParcel.codPaidToSender) {
      setErrorMessage('تم صرف هذه الحوالة مسبقاً.');
      return;
    }

    if (!payoutReadiness?.canPay) {
      setErrorMessage(payoutReadiness?.reasonText || 'لا يمكن صرف هذه الحوالة حالياً.');
      return;
    }

    if (!isAuthorizedRole) {
      setErrorMessage('ليس لديك الصلاحية الوظيفية لتنفيذ صرف وتسليم الحوالات.');
      return;
    }

    // Must be verified
    if (!verificationResult || !verificationResult.verified) {
      setErrorMessage('يجب التحقق من مطابقة بيانات هوية المرسل بنجاح قبل تنفيذ الصرف.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const effectiveAmount = matchedParcel.codAmount > 0 ? matchedParcel.codAmount : (matchedParcel.totalDue || 0);
    const effectiveCurrency: Currency = matchedParcel.codCurrency || (matchedParcel.codAmount > 1000 ? 'SYP' : matchedParcel.currency || 'SYP');
    const syp = effectiveCurrency === 'SYP' ? effectiveAmount : 0;
    const usd = effectiveCurrency === 'USD' ? effectiveAmount : 0;

    const fullNotes = [
      notes.trim(),
      `[التحقق: ${verificationMethod === 'scanner' ? 'ماسح الهوية' : 'يدوي'}]`,
      `[الرقم الوطني: ${recipientNationalId.trim()}]`,
      recipientMotherName ? `[اسم الأم: ${recipientMotherName.trim()}]` : '',
      recipientBirthDate ? `[الميلاد: ${recipientBirthDate.trim()}]` : '',
    ].filter(Boolean).join(' - ');

    try {
      const res = payoutCodToSender(matchedParcel.id, {
        recipientNationalId: recipientNationalId.trim(),
        recipientMotherName: recipientMotherName.trim(),
        recipientBirthDate: recipientBirthDate.trim(),
        sypAmount: syp,
        usdAmount: usd,
        paymentMethod,
        notes: fullNotes,
      });

      if (res.success) {
        const senderActualName = matchedParcel.sender?.name || (matchedParcel as any).senderName || 'المرسل';
        const successData = {
          voucherId: res.voucherId,
          voucherNumber: res.voucherNumber,
          recipientName: senderActualName,
          amount: effectiveAmount,
          currency: effectiveCurrency,
          trackingNumber: matchedParcel.trackingNumber,
          parcel: {
            ...matchedParcel,
            codPaidToSender: true,
            codSenderPayoutVoucherNumber: res.voucherNumber,
            codSenderPayoutDate: new Date().toISOString(),
            codSenderRecipientName: senderActualName,
            codSenderRecipientNationalId: recipientNationalId.trim(),
          },
          timestamp: new Date().toISOString(),
        };

        setRecentPayoutSuccess(successData);
        if (onSuccess) onSuccess(res.voucherId);

        // Update current matched parcel to show Layer 3 immediately
        setMatchedParcel(successData.parcel);
        resetIdVerificationFields();

        // ✅ الإصلاح: افتح إيصال COD تلقائياً
        setTimeout(() => {
          openCodPayoutReceipt(successData.parcel);
        }, 500);
      } else {
        setErrorMessage(res.message || 'حدث خطأ أثناء صرف الحوالة.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء معالجة الصرف.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp Notification
  const handleSendWhatsAppNotification = (p: Parcel) => {
    const phone = p.sender?.phone?.replace(/[^0-9]/g, '') || '';
    const cleanPhone = phone.startsWith('0') ? `963${phone.slice(1)}` : phone.startsWith('963') ? phone : `963${phone}`;
    const pCur = p.codCurrency || (p.codAmount > 1000 ? 'SYP' : p.currency || 'SYP');
    const amountStr = formatEnCurrency(p.codAmount || 0, pCur);
    const orig = branches.find((b) => b.id === p.originHubId);
    const branchName = orig?.name || currentBranch.name;
    const msg = `مرحباً السيد/ة ${p.sender?.name} المحترم،\nنعلمكم بأنه تم تحصيل مبلغ طردكم رقم [${p.trackingNumber}] بنجاح، ومبلغ الحوالة ضد الدفع البالغ (${amountStr}) جاهز للتسليم الآن في فرعنا (${branchName}).\nيرجى التفضل بالقدوم مصطحبين إثبات الشخصية الأصلي لتأكيد الهوية والاستلام.\nشكراً لتعاملكم مع أوركا إكسبريس.`;

    notifySenderForCodPayout(p.id, 'whatsapp', 'تم إرسال إشعار عبر واتساب للقدوم واستلام الحوالة');
    setNotificationSentMessage('تم توثيق إشعار المرسل عبر واتساب بنجاح!');

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  const handleCopyTracking = (tr: string) => {
    navigator.clipboard.writeText(tr);
    setCopiedTracking(tr);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const handleClose = () => {
    if (onClose) onClose();
    closeCodSenderPayoutModal();
  };

  if (!effectiveIsOpen) return null;

  const codCur = matchedParcel ? (matchedParcel.codCurrency || (matchedParcel.codAmount > 1000 ? 'SYP' : matchedParcel.currency || 'SYP')) : 'SYP';
  const originBranch = matchedParcel ? branches.find((b) => b.id === matchedParcel.originHubId || b.id === matchedParcel.originBranchId) : null;
  const destBranch = matchedParcel ? branches.find((b) => b.id === matchedParcel.destinationHubId) : null;

  return (
    <div
      id="cod_sender_payout_fullscreen_view"
      className="fixed inset-0 z-50 bg-slate-950 w-screen h-screen flex flex-col font-['Cairo',sans-serif] text-right overflow-hidden animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden border-t-4 border-t-amber-500">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-md shadow-amber-950/40 shrink-0">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  صرف حوالة COD للمرسل — التحقق الصارم من الهوية
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-amber-300">
                  {isSuperAdmin ? 'إشراف عام' : `فرع ${currentBranch?.name}`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                الاسم للقراءة فقط • التحقق الإلزامي من الرقم الوطني واسم الأم والميلاد لمنع أي انتحال صفة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* View Switcher for Super Admin only */}
            {isSuperAdmin && (
              <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setAdminTab('list')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'list'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>جدول الحوالات</span>
                  <span className="px-1.5 py-0.5 bg-slate-950/70 rounded-full text-[10px] text-amber-300 font-mono">
                    {allReadyCodParcels.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminTab('payout_form')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    adminTab === 'payout_form'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{matchedParcel ? 'نموذج التحقق والصرف' : 'بحث بالإيصال'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUCCESS NOTIFICATION BANNER                                               */}
        {/* ========================================================================= */}
        {recentPayoutSuccess && (
          <div className="p-4 bg-emerald-950/90 border-b border-emerald-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <strong className="text-white text-sm block">
                  تم تسليم الحوالة وصرف المبلغ بنجاح للمرسل ({recentPayoutSuccess.recipientName})!
                </strong>
                <span className="text-emerald-300 font-mono mt-0.5 block">
                  المبلغ: {formatEnCurrency(recentPayoutSuccess.amount, recentPayoutSuccess.currency)} | سند الصرف رقم [{recentPayoutSuccess.voucherNumber || 'PV-COD'}]
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCodPayoutReceipt(recentPayoutSuccess.parcel)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer transition active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة سند الصرف والإيصال 🖨️</span>
              </button>
              <button
                type="button"
                onClick={() => setRecentPayoutSuccess(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUPER ADMIN MASTER VIEW: LIST OF ALL COD REMITTANCES                      */}
        {/* ========================================================================= */}
        {isSuperAdmin && adminTab === 'list' && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5 bg-slate-900/80">
            
            {/* KPI Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400">إجمالي الحوالات المجمعة</div>
                  <div className="text-lg font-black text-white font-mono">{formatEnNumber(allReadyCodParcels.length)} حوالة</div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400">إجمالي المبالغ (ل.س)</div>
                  <div className="text-lg font-black text-emerald-300 font-mono">{formatEnNumber(totalSypAmount)} <span className="text-xs">SYP</span></div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400">إجمالي المبالغ ($)</div>
                  <div className="text-lg font-black text-cyan-300 font-mono">${formatEnNumber(totalUsdAmount)} <span className="text-xs">USD</span></div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400">تم إشعار المرسل</div>
                  <div className="text-lg font-black text-blue-300 font-mono">{formatEnNumber(totalNotifiedCount)} / {formatEnNumber(allReadyCodParcels.length)}</div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar Ribbon for Super Admin */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    placeholder="بحث سريع برقم الإيصال، البوليصة، اسم أو هاتف المرسل أو المستلم..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pr-10 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  />
                  {adminSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAdminSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shrink-0">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={adminBranchFilter}
                      onChange={(e) => setAdminBranchFilter(e.target.value)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900 text-white">كافة فروع الصادر</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                          فرع {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shrink-0">
                    <Coins className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={adminCurrencyFilter}
                      onChange={(e) => setAdminCurrencyFilter(e.target.value as any)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900 text-white">كافة العملات</option>
                      <option value="SYP" className="bg-slate-900 text-white">ليرة سورية (SYP)</option>
                      <option value="USD" className="bg-slate-900 text-white">دولار أمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={adminSmsFilter}
                      onChange={(e) => setAdminSmsFilter(e.target.value as any)}
                      className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900 text-white">كافة حالات الإشعار</option>
                      <option value="notified" className="bg-slate-900 text-white">تم إشعار المرسل</option>
                      <option value="pending_notice" className="bg-slate-900 text-white">بانتظار الإشعار</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Ready Remittances Data Table */}
            {filteredAdminCodList.length > 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-bold">
                        <th className="py-3 px-4">رقم الإيصال والتتبع</th>
                        <th className="py-3 px-4">فرع الصادر ◄ الوجهة</th>
                        <th className="py-3 px-4">المرسل (المستحق)</th>
                        <th className="py-3 px-4">مبلغ الحوالة (COD)</th>
                        <th className="py-3 px-4 text-center">حالة الصرف</th>
                        <th className="py-3 px-4 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredAdminCodList.map((p) => {
                        const cur = p.codCurrency || (p.codAmount > 1000 ? 'SYP' : p.currency || 'SYP');
                        const origB = branches.find((b) => b.id === p.originHubId || b.id === p.originBranchId);
                        const destB = branches.find((b) => b.id === p.destinationHubId);
                        const isPaid = Boolean(p.codPaidToSender || p.codStatus === 'paid_to_sender');

                        return (
                          <tr key={p.id} className="hover:bg-slate-900/50 transition group">
                            {/* Receipt & Tracking */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 font-mono font-black text-amber-300">
                                  <span>{p.paperReceiptNumber || 'بدون إيصال'}</span>
                                  {p.paperReceiptNumber && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyTracking(p.paperReceiptNumber!)}
                                      className="text-slate-500 hover:text-amber-400 p-0.5 transition"
                                      title="نسخ رقم الإيصال"
                                    >
                                      {copiedTracking === p.paperReceiptNumber ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {p.trackingNumber}
                                </div>
                              </div>
                            </td>

                            {/* Origin Hub & Dest Hub */}
                            <td className="py-3.5 px-4">
                              <div className="text-slate-300 font-bold flex items-center gap-1">
                                <span className="text-emerald-400">{origB?.name || p.originHubId || 'فرع الصادر'}</span>
                                <span className="text-slate-600">◄</span>
                                <span className="text-slate-400">{destB?.name || p.destinationHubId || 'فرع الوجهة'}</span>
                              </div>
                            </td>

                            {/* Sender */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="font-bold text-white flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{p.sender?.name || (p as any).senderName || 'غير محدد'}</span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                                  <span>{p.sender?.phone || (p as any).senderPhone || '-'}</span>
                                </div>
                              </div>
                            </td>

                            {/* COD Amount */}
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-black text-sm text-emerald-400">
                                {formatEnNumber(p.codAmount || 0)}
                                <span className="text-[10px] mr-1 text-emerald-500/80">{cur}</span>
                              </div>
                            </td>

                            {/* Payout Status Badge */}
                            <td className="py-3.5 px-4 text-center">
                              {isPaid ? (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>✅ تم الصرف</span>
                                  </span>
                                  {p.codSenderPayoutDate && (
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {formatEnDateTime(p.codSenderPayoutDate).split(',')[0]}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/50 text-[10px] font-bold">
                                  جاهزة للتسليم
                                </span>
                              )}
                            </td>

                            {/* Direct Payout Action */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleSelectParcelForPayout(p)}
                                className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer transition active:scale-95 ${
                                  isPaid
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
                                }`}
                              >
                                <span>{isPaid ? 'عرض السند' : 'تحقق وصرف'}</span>
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4 max-w-md mx-auto bg-slate-950/80 p-8 rounded-3xl border border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <HandCoins className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white">
                  لا توجد حوالات مطابقة لخيارات البحث
                </h3>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SINGLE SEARCH & 3-LAYER PAYOUT WORKFLOW                                    */}
        {/* ========================================================================= */}
        {(!isSuperAdmin || adminTab === 'payout_form') && (
          <>
            {/* Top Search Ribbon */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePerformSearch();
                }}
                className="flex flex-col sm:flex-row items-center gap-3"
              >
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setAdminTab('list')}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer shrink-0"
                  >
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                    <span>العودة لجدول الحوالات</span>
                  </button>
                )}

                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="input_receipt_search_number"
                    value={receiptSearchNumber}
                    autoFocus
                    onChange={(e) => setReceiptSearchNumber(e.target.value)}
                    placeholder="أدخل رقم الحوالة / رقم البوليصة، أو امسح باركود الإيصال الورقي..."
                    className="w-full bg-slate-900 border-2 border-amber-500/40 rounded-2xl pr-10 pl-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition shadow-inner font-mono font-bold"
                  />
                  {receiptSearchNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptSearchNumber('');
                        setMatchedParcel(null);
                        setHasSearched(false);
                        resetIdVerificationFields();
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer transition active:scale-95 shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>بحث عن الحوالة</span>
                </button>
              </form>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5 bg-slate-900/60">

              {/* Error Message Toast */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span className="font-bold leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Initial State (Before Searching) */}
              {!hasSearched && !matchedParcel && (
                <div className="text-center py-16 space-y-4 max-w-lg mx-auto">
                  <div className="w-20 h-20 rounded-3xl bg-slate-950 border border-slate-800 text-amber-400/80 flex items-center justify-center mx-auto shadow-xl">
                    <Receipt className="w-10 h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white">
                      أدخل رقم الإيصال الورقي أو البوليصة للاستعلام
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      يتم تسليم حوالة COD حصراً بعد التأكد من مطابقة الرقم الوطني واسم الأم وتاريخ الولادة للمرسل الأصلي المسجل بالبوليصة.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-amber-300/80 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 max-w-md mx-auto">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>اسم المرسل للقراءة فقط ولا يمكن تعديله لمنع الاحتيال</span>
                  </div>
                </div>
              )}

              {/* Searched & No Parcel Found */}
              {hasSearched && !matchedParcel && (
                <div className="text-center py-14 space-y-4 max-w-md mx-auto bg-slate-950/80 p-6 rounded-3xl border border-slate-800">
                  <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    لم يتم العثور على أي شحنة أو إيصال برقم [{searchedQuery}]
                  </h3>
                  <p className="text-xs text-slate-400">
                    يرجى التأكد من كتابة رقم الإيصال الورقي أو رقم البوليصة بالشكل الصحيح وإعادة المحاولة.
                  </p>
                </div>
              )}

              {/* ================================================================= */}
              {/* LAYER 3: READ-ONLY VIEW WHEN PARCEL IS ALREADY PAID                */}
              {/* ================================================================= */}
              {matchedParcel && matchedParcel.codPaidToSender && (
                <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in">
                  
                  {/* Big Green Badge */}
                  <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-950 to-emerald-950 border-2 border-emerald-500/60 text-center space-y-3 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-white">
                        ✅ تم صرف وتسليم هذه الحوالة بنجاح
                      </h3>
                      <p className="text-xs text-emerald-300 mt-1">
                        تم تسليم المبلغ وإصدار سند الصرف المالي وإقفال المطالبة بالكامل
                      </p>
                    </div>
                  </div>

                  {/* READ-ONLY Details Grid */}
                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span>بيانات سند الصرف والتوثيق المالي (READ-ONLY)</span>
                      </h4>
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300 font-bold">
                        {matchedParcel.trackingNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">قيمة الحوالة المصروفة:</span>
                        <strong className="text-emerald-400 text-lg block">
                          {formatEnCurrency(
                            matchedParcel.codSenderPayoutAmountSyp ||
                              matchedParcel.codSenderPayoutAmountUsd ||
                              matchedParcel.codAmount ||
                              0,
                            codCur
                          )}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">رقم سند الصرف:</span>
                        <strong className="text-cyan-300 text-base block font-bold">
                          {matchedParcel.codSenderPayoutVoucherNumber || 'PV-COD'}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">اسم المستلم المعتمد:</span>
                        <strong className="text-white text-sm font-sans block">
                          {matchedParcel.codSenderRecipientName || matchedParcel.sender?.name || 'المرسل'}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">الرقم الوطني للمستلم:</span>
                        <strong className="text-amber-300 text-sm block">
                          {matchedParcel.codSenderRecipientNationalId || matchedParcel.sender?.nationalId || 'مسجل بالسند'}
                        </strong>
                      </div>

                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">تاريخ وتوقيت الصرف:</span>
                        <span className="text-slate-300 text-xs block">
                          {formatEnDateTime(matchedParcel.codSenderPayoutDate || matchedParcel.updatedAt)}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                        <span className="text-[11px] text-slate-400 font-sans block">صرف بواسطة:</span>
                        <span className="text-slate-300 text-xs font-sans block">
                          {matchedParcel.codSenderPayoutByUserName || 'أمين الصندوق'}
                        </span>
                      </div>
                    </div>

                    {matchedParcel.codSenderPayoutNotes && (
                      <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                        <strong className="text-slate-300 block mb-0.5">ملاحظات التوثيق:</strong>
                        <span>{matchedParcel.codSenderPayoutNotes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for Paid Remittance */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => openCodPayoutReceipt(matchedParcel)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer transition active:scale-95"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة سند الصرف والإيصال 🖨️</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition"
                    >
                      إغلاق
                    </button>
                  </div>

                </div>
              )}

              {/* ================================================================= */}
              {/* LAYERS 1 & 2: PARCEL NOT YET PAID (VERIFICATION & DISBURSEMENT)    */}
              {/* ================================================================= */}
              {matchedParcel && !matchedParcel.codPaidToSender && (
                <div className="space-y-5">
                  
                  {/* Readiness Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                    payoutReadiness?.canPay
                      ? 'bg-gradient-to-r from-emerald-950/90 via-slate-950 to-emerald-950/90 border-emerald-500/60 text-emerald-200'
                      : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        payoutReadiness?.canPay
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      }`}>
                        {payoutReadiness?.canPay ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <AlertTriangle className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <strong className="text-sm font-black text-white block">
                          {payoutReadiness?.canPay
                            ? '✅ الحوالة محصلة وجاهزة للصرف بعد التحقق من الهوية'
                            : '⛔ الحوالة غير قابلة للصرف حالياً'}
                        </strong>
                        <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                          {payoutReadiness?.reasonText}
                        </p>
                      </div>
                    </div>

                    <div className="text-left bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/10 shrink-0 font-mono">
                      <span className="text-[10px] text-slate-400 block font-sans">قيمة الحوالة</span>
                      <span className="text-base sm:text-lg font-black text-emerald-400">
                        {formatEnCurrency(matchedParcel.codAmount || 0, codCur)}
                      </span>
                    </div>
                  </div>

                  {/* 2 COLUMNS: LAYER 1 (READ-ONLY DETAILS) & LAYER 2 (MANDATORY VERIFICATION) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* ============================================================= */}
                    {/* LAYER 1: PARCEL DATA (READ-ONLY) - 5 COLS                     */}
                    {/* ============================================================= */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5 shadow-md">
                        <div className="text-xs font-bold text-cyan-400 flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>الطبقة 1: بيانات البوليصة (READ-ONLY)</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {matchedParcel.trackingNumber}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs text-slate-300">
                          {/* SENDER NAME (READ-ONLY) */}
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block mb-0.5">اسم المرسل الأصلي (غير قابل للتعديل):</span>
                            <div className="flex items-center justify-between">
                              <strong className="text-white text-sm">
                                {matchedParcel.sender?.name || (matchedParcel as any).senderName || 'غير مسجل'}
                              </strong>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                للقراءة فقط 🔒
                              </span>
                            </div>
                          </div>

                          {/* MASKED NATIONAL ID */}
                          <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">آخر 4 من الرقم الوطني:</span>
                            <span className="font-mono font-bold text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {maskedSenderNationalId}
                            </span>
                          </div>

                          {/* PHONE */}
                          <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">هاتف المرسل:</span>
                            <span className="font-mono text-slate-200">
                              {matchedParcel.sender?.phone || 'غير مسجل'}
                            </span>
                          </div>

                          {/* COD AMOUNT */}
                          <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">المبلغ المستحق:</span>
                            <strong className="text-emerald-400 font-mono text-sm">
                              {formatEnCurrency(matchedParcel.codAmount || 0, codCur)}
                            </strong>
                          </div>

                          {/* ORIGIN HUB */}
                          <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">فرع الصرف الحصري:</span>
                            <span className="text-cyan-300 font-bold">
                              {originBranch?.name || matchedParcel.originHubId}
                            </span>
                          </div>

                          {/* RECEIPT NUMBER */}
                          {matchedParcel.paperReceiptNumber && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                              <span className="text-slate-400">رقم الإيصال الورقي:</span>
                              <span className="font-mono font-bold text-amber-400">
                                {matchedParcel.paperReceiptNumber}
                              </span>
                            </div>
                          )}

                          {/* DESTINATION */}
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400">فرع التحصيل:</span>
                            <span className="text-slate-300">
                              {destBranch?.name || matchedParcel.destinationHubId}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Shortcut */}
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 shadow-md">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>إشعار المرسل عبر واتساب</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppNotification(matchedParcel)}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>إرسال تنبيه بالجاهزية للقدوم</span>
                        </button>
                      </div>
                    </div>

                    {/* ============================================================= */}
                    {/* LAYER 2: MANDATORY IDENTITY VERIFICATION - 7 COLS             */}
                    {/* ============================================================= */}
                    <div className="lg:col-span-7 bg-slate-950/90 p-5 rounded-2xl border border-slate-800 space-y-5 shadow-xl">
                      
                      {/* Mode Switcher */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-amber-400" />
                          <div>
                            <h3 className="text-sm font-black text-white">
                              الطبقة 2: التحقق الإلزامي من هوية المستلم
                            </h3>
                            <span className="text-[11px] text-slate-400">
                              مطابقة كاملة 100% للرقم الوطني واسم الأم وتاريخ الولادة
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                          <button
                            type="button"
                            onClick={() => setVerificationMethod('scanner')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              verificationMethod === 'scanner'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Scan className="w-3.5 h-3.5" />
                            <span>مسح الهوية</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setVerificationMethod('manual')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              verificationMethod === 'manual'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>إدخال يدوي</span>
                          </button>
                        </div>
                      </div>

                      {/* SCANNER INPUT (WHEN SCANNER ACTIVE) */}
                      {verificationMethod === 'scanner' && (
                        <div className="space-y-3 p-3.5 rounded-xl bg-slate-900 border border-amber-500/30">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <QrCode className="w-4 h-4 text-amber-400" />
                              <span>مسح باركود الهوية السورية بالماسح الضوئي:</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleSimulateSyrianIdScan}
                              className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer font-bold"
                            >
                              ⚡ محاكاة مسح الهوية
                            </button>
                          </div>

                          <input
                            type="text"
                            ref={scannerInputRef}
                            value={scannerRawInput}
                            onChange={(e) => handleScannerInputChange(e.target.value)}
                            placeholder="مرر قارئ الباركود على ظهر الهوية الشخصية..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                      )}

                      {/* 3 MANDATORY VERIFICATION FIELDS */}
                      <div className="space-y-3.5">
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span>بيانات التحقق من الهوية (مطلوبة ومطابقة):</span>
                        </div>

                        {/* 1. National ID (11 Digits) */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1 text-xs">
                            1. الرقم الوطني (11 رقماً) <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={recipientNationalId}
                            onChange={(e) => {
                              setRecipientNationalId(e.target.value);
                              setVerificationResult(null);
                            }}
                            placeholder="أدخل الرقم الوطني المكون من 11 رقماً..."
                            maxLength={11}
                            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-white font-mono text-sm tracking-wider focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* 2. Mother Name */}
                          <div>
                            <label className="block text-slate-300 font-bold mb-1 text-xs">
                              2. اسم الأم <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={recipientMotherName}
                              onChange={(e) => {
                                setRecipientMotherName(e.target.value);
                                setVerificationResult(null);
                              }}
                              placeholder="اسم والدة المرسل..."
                              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                            />
                          </div>

                          {/* 3. Birth Date */}
                          <div>
                            <label className="block text-slate-300 font-bold mb-1 text-xs">
                              3. تاريخ الولادة <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={recipientBirthDate}
                              onChange={(e) => {
                                setRecipientBirthDate(e.target.value);
                                setVerificationResult(null);
                              }}
                              placeholder="YYYY-MM-DD أو DD/MM/YYYY"
                              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* VERIFY BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleRunVerification()}
                          className="w-full py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95"
                        >
                          <Search className="w-4 h-4" />
                          <span>🔍 تحقق من مطابقة البيانات الآن</span>
                        </button>
                      </div>

                      {/* VERIFICATION RESULT CARD */}
                      {verificationResult && (
                        <div className={`p-4 rounded-xl border space-y-1.5 transition animate-in fade-in ${
                          verificationResult.verified
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                            : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                        }`}>
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
                              ✓ تم التحقق بنجاح من مطابقة الرقم الوطني والبيانات الشخصية للمرسل. يمكنك الآن إتمام الصرف.
                            </div>
                          ) : (
                            <div className="text-[11px] text-rose-300 pt-1 border-t border-rose-500/30">
                              ⚠️ لا يمكن الصرف حتى تطابق كافة البيانات المطلوبة لمنع تسليم الحوالة لغير صاحبها.
                            </div>
                          )}
                        </div>
                      )}

                      {/* PAYMENT CONFIRMATION BAR */}
                      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-400">
                          {verificationResult?.verified ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              <span>جاهز للصرف المالي وإصدار السند</span>
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              <span>الزر معطل حتى اكتمال التحقق بنجاح</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!verificationResult?.verified || !payoutReadiness?.canPay || isSubmitting}
                          onClick={handleConfirmPayout}
                          className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-xl ${
                            verificationResult?.verified && payoutReadiness?.canPay && !isSubmitting
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-950/50 cursor-pointer active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <HandCoins className="w-4 h-4" />
                          )}
                          <span>تأكيد صرف وتسليم الحوالة للمرسل وإصدار السند 💵</span>
                        </button>
                      </div>

                    </div>
                  </div>

                </div>
              )}

            </div>
          </>
        )}

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-500" />
            <span>الصندوق المعتمد: {currentBranch?.name} ({currentUser?.name})</span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
