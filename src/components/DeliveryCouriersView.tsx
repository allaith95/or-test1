import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import { CourierCardModal } from './CourierCardModal';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import {
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  ScanLine,
  UserCheck,
  Camera,
  Upload,
  CheckCircle,
  Truck,
  DollarSign,
  Coins,
  Search,
  FileCheck,
  Printer,
  ShieldCheck,
  PackageCheck,
  Bike,
  Plus,
  UserPlus,
  X,
  Users,
  Phone,
  CreditCard,
  MapPin,
  Sparkles,
  RotateCcw,
  Check,
  CheckCircle2,
  Filter,
  Layers,
  ArrowDownUp,
  Boxes,
  Calendar,
  Receipt,
  FileText,
  Package,
} from 'lucide-react';
import { Parcel, User, CourierManifest } from '../types';
import { calculateParcelReceivable } from '../utils/settlementMath';
import { DeliveryHandoverModal } from './DeliveryHandoverModal';
import { extractCleanTrackingQuery } from '../utils/BarcodeScannerUtility';
import { CourierCustodySettlementModal } from './CourierCustodySettlementModal';

export const DeliveryCouriersView: React.FC = () => {
  const {
    currentBranch,
    currentUser,
    branches,
    users,
    parcels,
    courierManifests,
    deliverParcel,
    assignToCourier,
    settleCourierManifest,
    getCourierIntakeFinancials,
    settleCourierIntakeParcels,
    courierIntakeSettlements,
    openCourierIntakeVoucherPrint,
    addUser,
    openPrintModal,
    formatCurrency,
    formatNumber,
    setActiveModule,
    ensureServerConnected,
    receiveReturnedParcelAtBranch,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'counter_delivery' | 'courier_dispatch' | 'courier_intake_audit' | 'courier_returns_pending'>(() => {
    try {
      const saved = safeStorage.getItem('orca_delivery_couriers_tab');
      if (saved) return saved as any;
    } catch {}
    return 'counter_delivery';
  });

  useEffect(() => {
    try {
      safeStorage.setItem('orca_delivery_couriers_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Counter Delivery Modal State
  const [selectedParcelForDelivery, setSelectedParcelForDelivery] = useState<Parcel | null>(null);
  const [deliverySuccessMessage, setDeliverySuccessMessage] = useState<string | null>(null);

  // Courier Assignment State
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [selectedCourierParcelIds, setSelectedCourierParcelIds] = useState<string[]>([]);
  const [courierNotes, setCourierNotes] = useState('');

  // Barcode Scanner State for Courier Manifest Assignment
  const [scanBarcodeQuery, setScanBarcodeQuery] = useState('');
  const [scanFeedbackNotice, setScanFeedbackNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Audio Beep Helpers
  const playScanSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio context restricted
    }
  };

  const playScanErrorSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Audio context restricted
    }
  };

  // Add Authorized Courier Modal & Notice State
  const [isAddCourierModalOpen, setIsAddCourierModalOpen] = useState(false);
  const [newCourierNotice, setNewCourierNotice] = useState<string | null>(null);

  // Settle Courier State
  const [selectedCourierManifestId, setSelectedCourierManifestId] = useState('');
  const [deliveredIdsForSettlement, setDeliveredIdsForSettlement] = useState<string[]>([]);
  const [returnedIdsForSettlement, setReturnedIdsForSettlement] = useState<string[]>([]);
  const [settlingManifest, setSettlingManifest] = useState<CourierManifest | null>(null);

  // Search & Filter for Courier Dispatch Parcel Selection
  const [courierParcelSearch, setCourierParcelSearch] = useState('');
  const [courierPaymentFilter, setCourierPaymentFilter] = useState<'all' | 'cod' | 'collect' | 'prepaid'>('all');

  // Search Filter for Counter Delivery
  const [searchQuery, setSearchQuery] = useState('');

  // Ready for delivery parcels in current hub (Counter) - strictly arrived at destination
  const readyParcels = parcels.filter(
    (p) =>
      (isSuperAdmin || !currentBranch?.id || p.destinationHubId === currentBranch.id) &&
      p.handlingStatus === 'received_at_dest' &&
      (!searchQuery ||
        p.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.paperReceiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.receiver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.receiver.phone.includes(searchQuery))
  );

  // Ready in warehouse for Courier Assignment - strictly arrived at destination
  const warehouseReadyParcels = useMemo(() => {
    return parcels.filter(
      (p) =>
        (isSuperAdmin || !currentBranch?.id || p.destinationHubId === currentBranch.id) &&
        p.handlingStatus === 'received_at_dest'
    );
  }, [parcels, currentBranch?.id, isSuperAdmin]);

  // Returned parcels from couriers awaiting branch warehouse intake
  const courierReturnsPending = useMemo(() => {
    return parcels.filter(
      (p) =>
        (isSuperAdmin || !currentBranch?.id || p.currentLocationBranchId === currentBranch?.id || p.destinationHubId === currentBranch?.id) &&
        p.handlingStatus === 'returned'
    );
  }, [parcels, currentBranch?.id, isSuperAdmin]);

  // Filtered parcels for expanded courier assignment table
  const filteredDispatchParcels = useMemo(() => {
    return warehouseReadyParcels.filter((p) => {
      const q = courierParcelSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.trackingNumber.toLowerCase().includes(q) ||
        (p.paperReceiptNumber && p.paperReceiptNumber.toLowerCase().includes(q)) ||
        p.receiver.name.toLowerCase().includes(q) ||
        p.receiver.phone.includes(q) ||
        (p.receiver.address && p.receiver.address.toLowerCase().includes(q)) ||
        (p.receiver.city && p.receiver.city.toLowerCase().includes(q)) ||
        (p.contentDescription && p.contentDescription.toLowerCase().includes(q));

      const matchesPayment =
        courierPaymentFilter === 'all' ||
        (courierPaymentFilter === 'cod' && p.paymentType === 'cod') ||
        (courierPaymentFilter === 'collect' && p.paymentType === 'collect') ||
        (courierPaymentFilter === 'prepaid' && p.paymentType === 'prepaid');

      return matchesSearch && matchesPayment;
    });
  }, [warehouseReadyParcels, courierParcelSearch, courierPaymentFilter]);

  // Totals summary for currently selected parcels
  const selectedDispatchSummary = useMemo(() => {
    const selected = warehouseReadyParcels.filter((p) => selectedCourierParcelIds.includes(p.id));
    let freightSyp = 0;
    let freightUsd = 0;
    let codSyp = 0;
    let codUsd = 0;

    selected.forEach((p) => {
      if (p.paymentType === 'collect' || p.paymentType === 'cod') {
        if (p.currency === 'USD') freightUsd += p.shippingCost || 0;
        else freightSyp += p.shippingCost || 0;
      }
      if (p.codAmount > 0) {
        const c = p.codCurrency || p.currency;
        if (c === 'USD') codUsd += p.codAmount;
        else codSyp += p.codAmount;
      }
    });

    return {
      count: selected.length,
      freightSyp,
      freightUsd,
      codSyp,
      codUsd,
      totalSyp: freightSyp + codSyp,
      totalUsd: freightUsd + codUsd,
    };
  }, [warehouseReadyParcels, selectedCourierParcelIds]);

  // Couriers list strictly filtered to the current branch, its main hub, and sub-branches under the same hub
  const couriersList = useMemo(() => {
    const currentMainHubId =
      currentBranch.type === 'main_hub'
        ? currentBranch.id
        : currentBranch.parentHubId || currentBranch.id;

    return users.filter((u) => {
      if (u.role !== 'courier') return false;
      if (u.branchId === currentBranch.id) return true;
      if (u.allowedBranchIds && u.allowedBranchIds.includes(currentBranch.id)) return true;

      const courierBranch = branches.find((b) => b.id === u.branchId);
      if (!courierBranch) return false;

      const courierMainHubId =
        courierBranch.type === 'main_hub'
          ? courierBranch.id
          : courierBranch.parentHubId || courierBranch.id;

      return currentMainHubId === courierMainHubId;
    });
  }, [users, currentBranch, branches]);

  const selectedCourier = users.find((u) => u.id === selectedCourierId);

  // =========================================================================
  // COURIER INTAKE AUDIT & SETTLEMENT STATE (تدقيق واستلام طرود الموزعين وترصيد الصندوق)
  // =========================================================================
  const [selectedIntakeCourierId, setSelectedIntakeCourierId] = useState('');
  const [selectedAuditParcelIds, setSelectedAuditParcelIds] = useState<string[]>([]);
  const [auditBarcodeQuery, setAuditBarcodeQuery] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [auditSuccessNotice, setAuditSuccessNotice] = useState<string | null>(null);
  const [intakeAuditSubTab, setIntakeAuditSubTab] = useState<'audit_desk' | 'settlement_history'>('audit_desk');
  const intakeBarcodeRef = useRef<HTMLInputElement>(null);

  // Couriers with pending intake parcels calculation
  const couriersWithIntake = useMemo(() => {
    return couriersList.map((c) => {
      const fin = getCourierIntakeFinancials(c.id);
      return {
        courier: c,
        financials: fin,
      };
    });
  }, [couriersList, getCourierIntakeFinancials, parcels]);

  const totalPendingCouriersIntakeCount = useMemo(() => {
    return couriersWithIntake.filter((item) => item.financials.unsettledParcels.length > 0).length;
  }, [couriersWithIntake]);

  const totalUnsettledIntakeParcelsCount = useMemo(() => {
    return couriersWithIntake.reduce((acc, item) => acc + item.financials.unsettledParcels.length, 0);
  }, [couriersWithIntake]);

  const totalPendingIntakeSyp = useMemo(() => {
    return couriersWithIntake.reduce((acc, item) => acc + item.financials.totalPrepaidSyp, 0);
  }, [couriersWithIntake]);

  const totalPendingIntakeUsd = useMemo(() => {
    return couriersWithIntake.reduce((acc, item) => acc + item.financials.totalPrepaidUsd, 0);
  }, [couriersWithIntake]);

  const activeAuditCourierItem = useMemo(() => {
    return couriersWithIntake.find((item) => item.courier.id === selectedIntakeCourierId) || null;
  }, [couriersWithIntake, selectedIntakeCourierId]);

  // When courier is selected, auto-select all their unsettled parcels for audit
  useEffect(() => {
    if (activeAuditCourierItem) {
      setSelectedAuditParcelIds(activeAuditCourierItem.financials.unsettledParcels.map((p) => p.id));
    } else {
      setSelectedAuditParcelIds([]);
    }
  }, [selectedIntakeCourierId, activeAuditCourierItem?.financials.unsettledParcels.length]);

  // Selected audited totals
  const auditedTotals = useMemo(() => {
    if (!activeAuditCourierItem) return { syp: 0, usd: 0 };
    const checkedParcels = activeAuditCourierItem.financials.unsettledParcels.filter((p) =>
      selectedAuditParcelIds.includes(p.id)
    );
    let syp = 0;
    let usd = 0;
    checkedParcels.forEach((p) => {
      const isPrepaid =
        p.paymentType === 'prepaid' ||
        (p.paymentType === 'cod' && p.codShippingPayer === 'sender');
      if (isPrepaid) {
        const cost = Number(p.shippingCost) || 0;
        if (p.currency === 'SYP') syp += cost;
        else usd += cost;
      }
    });
    return { syp, usd };
  }, [activeAuditCourierItem, selectedAuditParcelIds]);

  // Handle Barcode Scan in Intake Audit
  const handleIntakeBarcodeScan = (codeToScan: string) => {
    const cleanCode = extractCleanTrackingQuery(codeToScan).trim().toUpperCase();
    if (!cleanCode || !activeAuditCourierItem) return;

    const matchedParcel = activeAuditCourierItem.financials.unsettledParcels.find(
      (p) =>
        p.trackingNumber.toUpperCase() === cleanCode ||
        p.paperReceiptNumber?.toUpperCase() === cleanCode
    );

    if (matchedParcel) {
      playScanSuccessSound();
      setSelectedAuditParcelIds((prev) =>
        prev.includes(matchedParcel.id) ? prev : [...prev, matchedParcel.id]
      );
      setAuditBarcodeQuery('');
    } else {
      playScanErrorSound();
    }
  };

  // Branch Intake Settlement History
  const branchIntakeVouchers = useMemo(() => {
    return courierIntakeSettlements.filter(
      (v) => isSuperAdmin || !currentBranch?.id || v.branchId === currentBranch.id
    );
  }, [courierIntakeSettlements, currentBranch?.id, isSuperAdmin]);

  const handleOpenAddCourierModal = () => {
    if (!isSuperAdmin) return;
    setIsAddCourierModalOpen(true);
  };

  const openDeliverDialog = (parcel: Parcel) => {
    setSelectedParcelForDelivery(parcel);
  };

  // Auto-focus barcode input when tab changes or courier is selected
  React.useEffect(() => {
    if (activeTab === 'courier_dispatch' && selectedCourierId) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [activeTab, selectedCourierId]);

  // Handle Barcode Scan / Keypress
  const handleBarcodeScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawQuery = scanBarcodeQuery.trim();
    if (!rawQuery) return;

    if (!selectedCourierId) {
      playScanErrorSound();
      setScanFeedbackNotice({
        type: 'warning',
        message: '⚠️ يرجى اختيار الموزع المعتمد أولاً قبل مسح باركود البوالص!',
      });
      setScanBarcodeQuery('');
      return;
    }

    const cleanQuery = extractCleanTrackingQuery(rawQuery).toLowerCase();
    const lowerRaw = rawQuery.toLowerCase();

    // 1. Search in warehouseReadyParcels (Direct Ready Matches)
    const matchedParcel = warehouseReadyParcels.find(
      (p) =>
        p.trackingNumber.toLowerCase() === cleanQuery ||
        p.trackingNumber.toLowerCase() === lowerRaw ||
        (p.paperReceiptNumber && (
          p.paperReceiptNumber.toLowerCase() === cleanQuery ||
          p.paperReceiptNumber.toLowerCase() === lowerRaw
        )) ||
        p.id === cleanQuery ||
        p.id === lowerRaw
    );

    if (matchedParcel) {
      if (selectedCourierParcelIds.includes(matchedParcel.id)) {
        playScanErrorSound();
        setScanFeedbackNotice({
          type: 'warning',
          message: `⚠️ البوليصة [${matchedParcel.trackingNumber}] مضافة بالفعل في المانافيست الحالي!`,
        });
      } else {
        playScanSuccessSound();
        setSelectedCourierParcelIds((prev) => [...prev, matchedParcel.id]);
        setScanFeedbackNotice({
          type: 'success',
          message: `✅ تم إدراج البوليصة [${matchedParcel.trackingNumber}] للمستلم (${matchedParcel.receiver.name}) بمانافيست الموزع بنجاح!`,
        });
      }
    } else {
      // 2. Intelligent Diagnostic Check against ALL parcels in the system
      const anyMatch = parcels.find(
        (p) =>
          p.trackingNumber.toLowerCase() === cleanQuery ||
          p.trackingNumber.toLowerCase() === lowerRaw ||
          (p.paperReceiptNumber && (
            p.paperReceiptNumber.toLowerCase() === cleanQuery ||
            p.paperReceiptNumber.toLowerCase() === lowerRaw
          )) ||
          p.id === cleanQuery ||
          p.id === lowerRaw
      );

      playScanErrorSound();

      if (anyMatch) {
        // Find specific reason why it's not ready in this warehouse for this courier
        const isDifferentBranch = !isSuperAdmin && currentBranch?.id && (anyMatch.destinationHubId !== currentBranch.id && anyMatch.currentLocationBranchId !== currentBranch.id);
        const destBranchObj = branches.find((b) => b.id === anyMatch.destinationHubId);
        const destBranchName = destBranchObj?.name || 'فرع آخر';

        if (isDifferentBranch) {
          setScanFeedbackNotice({
            type: 'warning',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] موجهة لفرع (${destBranchName}) وليست بفرعك الحالي (${currentBranch.name})!`,
          });
        } else if (anyMatch.handlingStatus === 'delivered') {
          setScanFeedbackNotice({
            type: 'warning',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] تم تسليمها مسبقاً للزبون (${anyMatch.receiver.name})!`,
          });
        } else if (anyMatch.handlingStatus === 'with_courier' || anyMatch.handlingStatus === 'out_for_delivery') {
          setScanFeedbackNotice({
            type: 'warning',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] مُسندة بالفعل لموزع آخر (${anyMatch.assignedCourierName || 'قيد التوصيل'})!`,
          });
        } else if (anyMatch.handlingStatus === 'received_at_origin_hub' || anyMatch.handlingStatus === 'received_at_hub') {
          setScanFeedbackNotice({
            type: 'warning',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] ما زالت بمركز الانطلاق ولم تُشحن وتصل إلى مستودع الوصول بعد!`,
          });
        } else if (anyMatch.handlingStatus === 'loaded_in_truck' || anyMatch.handlingStatus === 'in_transit') {
          setScanFeedbackNotice({
            type: 'warning',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] في الطريق بالشاحنة، يرجى استلام وتفريغ الشاحنة أولاً في قسم الوارد!`,
          });
        } else {
          setScanFeedbackNotice({
            type: 'error',
            message: `⚠️ البوليصة [${anyMatch.trackingNumber}] حالتها الحالية (${anyMatch.handlingStatus}) غير جاهزة للتسليم للموزع بالمستودع.`,
          });
        }
      } else {
        setScanFeedbackNotice({
          type: 'error',
          message: `❌ لم يتم العثور على أي بوليصة بالرمز [${cleanQuery || rawQuery}] في قاعدة البيانات!`,
        });
      }
    }

    setScanBarcodeQuery('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Handle Courier Manifest Creation
  const handleCreateCourierManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ensureServerConnected();
    if (!ok) return;

    if (!selectedCourierId) {
      alert('يرجى اختيار الموزع المعتمد أولاً');
      return;
    }
    if (selectedCourierParcelIds.length === 0) {
      alert('يرجى مسح أو تحديد طرد واحد على الأقل لإدراجه في مانافيست الموزع');
      return;
    }

    const createdManifest = assignToCourier(selectedCourierId, selectedCourierParcelIds, courierNotes);
    setDeliverySuccessMessage(
      `تم توليد وتسليم مانافيست التوزيع بنجاح [${createdManifest.manifestNumber}] ونقل عهدة (${selectedCourierParcelIds.length}) طرد للموزع [${selectedCourier?.name || 'الموزع'}]!`
    );

    // Open A4 print modal if needed
    openPrintModal('manifest_a4', {
      id: createdManifest.id,
      manifestNumber: createdManifest.manifestNumber,
      originHubId: currentBranch.id,
      destinationHubId: currentBranch.id,
      driverName: selectedCourier?.name || 'الموزع',
      driverPhone: selectedCourier?.phone || '',
      truckPlate: selectedCourier?.nationalId || 'موزع محلي',
      truckType: 'دراجة توزيع / شاحنة صغيرة',
      status: 'dispatched',
      createdById: currentUser.id,
      parcelIds: selectedCourierParcelIds,
      createdAt: createdManifest.assignedAt,
      dispatchedAt: createdManifest.assignedAt,
      totalPieces: selectedCourierParcelIds.length,
      totalWeightKg: 0,
      totalFreightSyp: 0,
      totalFreightUsd: 0,
      totalCodSyp: 0,
      totalCodUsd: 0,
      notes: courierNotes,
      isCourierManifest: true,
      courierId: selectedCourier?.id,
      courierName: selectedCourier?.name,
      courierPhone: selectedCourier?.phone,
    });

    setSelectedCourierParcelIds([]);
    setCourierNotes('');
    setCourierParcelSearch('');
    setScanBarcodeQuery('');
    setScanFeedbackNotice(null);
  };

  const activeCourierManifests = courierManifests.filter(
    (m) => m.hubId === currentBranch.id && m.status === 'active'
  );

  return (
    <div className="space-y-4 pb-20 text-slate-100">
      {/* Top Header Card - Compact */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              <span>قسم التسليم</span>
            </span>
            <h1 className="text-sm sm:text-base font-black text-white">
              تسليم الطرود للعملاء، التحقق بالهوية، وإدارة تسليم الموزعين
            </h1>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            المركز: {currentBranch.name}
          </span>
        </div>

        <button
          onClick={() => setActiveModule('courier_portal')}
          className="bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
        >
          <Truck className="w-4 h-4 text-purple-300" />
          <span>📱 واجهة الجوال الخاصة بالموزع</span>
        </button>
      </div>

      {deliverySuccessMessage && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between text-emerald-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span>{deliverySuccessMessage}</span>
          </div>
          <button
            onClick={() => setDeliverySuccessMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 w-fit text-xs">
        <button
          onClick={() => setActiveTab('counter_delivery')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'counter_delivery'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>تسليم مباشر على الكاونتر (قارئ الهوية)</span>
        </button>

        <button
          onClick={() => setActiveTab('courier_dispatch')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'courier_dispatch'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          <span>مانافيست الموزعين والعهدة ({activeCourierManifests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courier_intake_audit')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'courier_intake_audit'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>تدقيق واستلام طرود الموزعين وترصيد الصندوق ({totalPendingCouriersIntakeCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('courier_returns_pending')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'courier_returns_pending'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-rose-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>المرتجعات بانتظار استلامك ({courierReturnsPending.length})</span>
        </button>
      </div>

      {/* TAB 1: COUNTER DIRECT DELIVERY WITH BARCODE SCANNER */}
      {activeTab === 'counter_delivery' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-emerald-400" />
                <span>الطرود الجاهزة للتسليم المباشر للمستلم ({readyParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                اختر الطرد للبدء بعملية مسح الهوية وتحصيل الرسوم
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم التتبع أو المستلم..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع والنوع</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم ورقم الهاتف</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل والمدينة</th>
                  <th className="py-2.5 px-3 font-semibold">طريقة السداد والعملة</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ المطلوب تحصيله</th>
                  <th className="py-2.5 px-3 font-semibold">الحالة الحالية</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {readyParcels.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد طرود جاهزة للتسليم حالياً
                    </td>
                  </tr>
                ) : (
                  readyParcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                          <span>{parcel.trackingNumber}</span>
                          {parcel.paperReceiptNumber && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                              {parcel.paperReceiptNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{parcel.packageType}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-200">{parcel.receiver.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {parcel.receiver.phone}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-300">{parcel.sender.name}</div>
                        <div className="text-[10px] text-slate-500">{parcel.sender.city}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold inline-block ${
                              parcel.paymentType === 'cod'
                                ? 'bg-amber-900/60 text-amber-300 border border-amber-500/30'
                                : parcel.paymentType === 'prepaid'
                                ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/30'
                                : 'bg-blue-900/60 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {parcel.paymentType === 'cod'
                              ? 'ضد الدفع (COD)'
                              : parcel.paymentType === 'prepaid'
                              ? 'مدفوع سلفاً'
                              : 'على المستلم'}
                          </span>
                          {parcel.paymentType === 'cod' && parcel.shippingCurrency && parcel.shippingCurrency !== parcel.currency && (
                            <div className="text-[9px] text-slate-400 font-mono">
                              عملات متعددة (هجين)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {(() => {
                          const s = getParcelPaymentSummary(parcel);
                          if (s.normalizedType === 'cod' && !s.isSameCurrency) {
                            return (
                              <div className="space-y-0.5">
                                <div className="font-bold text-amber-400 text-xs">
                                  حوالة: {formatCurrency(s.totalCodDue, s.codCurrency)}
                                </div>
                                <div className={`text-[10px] font-semibold ${s.isShippingPrepaidBySender ? 'text-cyan-300' : 'text-emerald-400'}`}>
                                  شحن: {formatCurrency(s.shippingCost, s.shippingCurrency)} {s.isShippingPrepaidBySender && '(مسدد)'}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="font-bold text-emerald-400 text-xs">
                              {s.summaryDueText}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {parcel.handlingStatus === 'with_courier'
                            ? 'مع الموزع'
                            : 'بالمستودع جاهز'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => openDeliverDialog(parcel)}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1 mx-auto transition-all transform active:scale-95"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          <span>تسليم وقراءة الهوية ◄</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COURIER MANIFEST & CUSTODY */}
      {activeTab === 'courier_dispatch' && (
        <div className="space-y-6">
          {/* Top Form & Expanded High-Precision Parcel Selection Table */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>إسناد طرود لموزع محلي وإصدار مانافيست التوزيع والعهدة</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    اختر الموزع المعتمد وحدد الطرود المتاحة بالمستودع لنقل عهدتها المالية والميدانية للموزع
                  </p>
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAddCourierModal}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 shrink-0 self-start sm:self-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ إضافة موزع معتمد جديد</span>
                </button>
              )}
            </div>

            {/* Notice if courier was just added */}
            {newCourierNotice && (
              <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{newCourierNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCourierNotice(null)}
                  className="text-emerald-400 hover:text-white text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleCreateCourierManifest} className="space-y-5">
              {/* Courier and Route Controls */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Courier Selector */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    الموزع / المندوب المعتمد <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <select
                        value={selectedCourierId}
                        onChange={(e) => setSelectedCourierId(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                      >
                        <option value="">-- اختر الموزع المعتمد --</option>
                        {couriersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}){c.nationalId ? ` - هوية: ${c.nationalId}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selected Courier Summary Badge */}
                  {selectedCourier && (
                    <div className="p-2.5 bg-slate-950/90 border border-emerald-500/30 rounded-xl flex items-center justify-between text-[11px] text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {selectedCourier.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{selectedCourier.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{selectedCourier.phone}</span>
                        </div>
                      </div>
                      {selectedCourier.nationalId ? (
                        <span className="text-slate-400 text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          هوية: {selectedCourier.nationalId}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[10px] font-bold">معتمد</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Route and Notes */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    خط السير وملاحظات التوزيع
                  </label>
                  <input
                    type="text"
                    value={courierNotes}
                    onChange={(e) => setCourierNotes(e.target.value)}
                    placeholder="مثال: جولة حي المزة وكفرسوسة - تسليم تجاري صباحي"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="text-[10px] text-slate-400">
                    يمكنك كتابة المنطقة أو أي تعليمات خاصة لمندوب التوزيع
                  </div>
                </div>

                {/* Submit Manifest Generation Button */}
                <div className="md:col-span-3 pt-6">
                  <button
                    type="submit"
                    disabled={selectedCourierParcelIds.length === 0 || !selectedCourierId}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileCheck className="w-5 h-5" />
                    <span>تسليم المانافيست للموزع ({selectedCourierParcelIds.length} طرد) 🚚</span>
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* BARCODE SCANNER FAST INPUT FOR COURIER MANIFEST INCLUSION */}
              {/* ========================================================================= */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <ScanLine className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                        إدراج طرد في المانافيست عبر مسح الباركود
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono font-bold">
                          مسح سريع تلقائي
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        امسح باركود البوليصة بقارئ الباركود اليدوي للإدراج الفوري التلقائي في عهدة الموزع
                      </p>
                    </div>
                  </div>

                  {selectedCourierParcelIds.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-500/40 text-xs font-bold text-emerald-300">
                      <span>الطرود الممسوحة بالمانافيست:</span>
                      <span className="font-mono font-black text-sm text-emerald-200">{selectedCourierParcelIds.length}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="w-5 h-5 text-emerald-400 absolute right-3.5 top-3" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={scanBarcodeQuery}
                      onChange={(e) => setScanBarcodeQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBarcodeScanSubmit();
                        }
                      }}
                      placeholder={
                        selectedCourierId
                          ? "امسح باركود البوليصة أو أدخل رقم التتبع واضغط Enter..."
                          : "⚠️ يرجى اختيار الموزع المعتمد أولاً للبدء بمسح الباركود..."
                      }
                      className="w-full bg-slate-900 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-xl pr-11 pl-4 py-2.5 text-xs sm:text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-inner"
                    />
                    {scanBarcodeQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setScanBarcodeQuery('');
                          barcodeInputRef.current?.focus();
                        }}
                        className="absolute left-3 top-3 text-slate-400 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBarcodeScanSubmit()}
                    disabled={!scanBarcodeQuery.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إدراج بالمانافيست</span>
                  </button>
                </div>

                {/* Scan Notice Alert */}
                {scanFeedbackNotice && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
                      scanFeedbackNotice.type === 'success'
                        ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                        : scanFeedbackNotice.type === 'warning'
                        ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                        : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
                    }`}
                  >
                    <span>{scanFeedbackNotice.message}</span>
                    <button
                      type="button"
                      onClick={() => setScanFeedbackNotice(null)}
                      className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Scanned Parcels Quick Chips / List */}
                {selectedCourierParcelIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                      <span>البوالص المدرجة بالمانافيست الحالية ({selectedCourierParcelIds.length}):</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCourierParcelIds([])}
                        className="text-rose-400 hover:text-rose-300 text-[10px] font-bold cursor-pointer"
                      >
                        تفريغ القائمة ✕
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                      {selectedCourierParcelIds.map((id) => {
                        const p = warehouseReadyParcels.find((item) => item.id === id) || parcels.find((item) => item.id === id);
                        if (!p) return null;

                        return (
                          <div
                            key={id}
                            className="px-2.5 py-1 bg-slate-900 border border-emerald-500/40 rounded-lg text-xs flex items-center gap-2 text-white font-mono shadow-sm group hover:border-rose-500/50 transition-all"
                          >
                            <span className="text-cyan-300 font-bold">{p.trackingNumber}</span>
                            <span className="text-[10px] text-slate-300 font-sans font-normal truncate max-w-[120px]">
                              ({p.receiver.name})
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedCourierParcelIds((prev) => prev.filter((i) => i !== id))}
                              className="text-slate-500 hover:text-rose-400 font-bold text-xs cursor-pointer mr-0.5"
                              title="إزالة هذا الطرد من المانافيست"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* EXPANDED HIGH-PRECISION PARCEL SELECTION TABLE (الموسع والمفصل) */}
              {/* ========================================================================= */}
              <div className="border border-slate-800 rounded-2xl p-3 sm:p-4 bg-slate-950/60 space-y-3.5 shadow-inner">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs font-black text-white whitespace-nowrap">
                      جدول اختيار طرود المستودع ({warehouseReadyParcels.length} طرد جاهز)
                    </span>
                  </div>

                  {/* Fast Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={courierParcelSearch}
                      onChange={(e) => setCourierParcelSearch(e.target.value)}
                      placeholder="بحث سريع برقم البوليصة، المستلم، الهاتف، العنوان، أو المحتويات..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {courierParcelSearch && (
                      <button
                        type="button"
                        onClick={() => setCourierParcelSearch('')}
                        className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Payment Filters & Batch Selection */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setCourierPaymentFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                          courierPaymentFilter === 'all'
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        الكل ({warehouseReadyParcels.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourierPaymentFilter('cod')}
                        className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                          courierPaymentFilter === 'cod'
                            ? 'bg-amber-600 text-white'
                            : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        COD ({warehouseReadyParcels.filter((p) => p.paymentType === 'cod').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourierPaymentFilter('collect')}
                        className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                          courierPaymentFilter === 'collect'
                            ? 'bg-cyan-600 text-white'
                            : 'text-cyan-400 hover:text-cyan-300'
                        }`}
                      >
                        على المستلم ({warehouseReadyParcels.filter((p) => p.paymentType === 'collect').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourierPaymentFilter('prepaid')}
                        className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                          courierPaymentFilter === 'prepaid'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        مدفوع سلفاً ({warehouseReadyParcels.filter((p) => p.paymentType === 'prepaid').length})
                      </button>
                    </div>

                    {/* Batch buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const shownIds = filteredDispatchParcels.map((p) => p.id);
                          setSelectedCourierParcelIds((prev) => Array.from(new Set([...prev, ...shownIds])));
                        }}
                        className="px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-bold transition cursor-pointer"
                        title="تحديد كل الطرود المطابقة لنتائج البحث الحالية"
                      >
                        تحديد المعروض ({filteredDispatchParcels.length})
                      </button>

                      {selectedCourierParcelIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCourierParcelIds([])}
                          className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-[11px] font-bold transition cursor-pointer"
                        >
                          إلغاء التحديد ({selectedCourierParcelIds.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Custody Financial Totals Summary Bar */}
                <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">الطرود المحددة للعهدة:</span>
                    <span className="px-2.5 py-0.5 rounded-lg font-mono font-black text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedDispatchSummary.count} طرد
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-slate-400">أجور شحن مطلوبة: </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {formatCurrency(selectedDispatchSummary.freightSyp || 0, 'SYP')}
                      </span>
                      {selectedDispatchSummary.freightUsd > 0 && (
                        <span className="font-mono font-bold text-cyan-300 mr-1">
                          + {formatCurrency(selectedDispatchSummary.freightUsd, 'USD')}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400">مبالغ بضائع (COD): </span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatCurrency(selectedDispatchSummary.codSyp || 0, 'SYP')}
                      </span>
                      {selectedDispatchSummary.codUsd > 0 && (
                        <span className="font-mono font-bold text-amber-300 mr-1">
                          + {formatCurrency(selectedDispatchSummary.codUsd, 'USD')}
                        </span>
                      )}
                    </div>

                    <div className="bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                      <span className="text-emerald-300 font-bold">إجمالي العهدة النقدية: </span>
                      <span className="font-mono font-black text-emerald-300 text-sm">
                        {formatCurrency(selectedDispatchSummary.totalSyp || 0, 'SYP')}
                      </span>
                      {selectedDispatchSummary.totalUsd > 0 && (
                        <span className="font-mono font-black text-emerald-300 text-sm mr-1">
                          + {formatCurrency(selectedDispatchSummary.totalUsd, 'USD')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* The Detailed Expanded Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900/95 sticky top-0 z-10 text-slate-300 border-b border-slate-800 font-bold">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredDispatchParcels.length > 0 &&
                                filteredDispatchParcels.every((p) => selectedCourierParcelIds.includes(p.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const shownIds = filteredDispatchParcels.map((p) => p.id);
                                  setSelectedCourierParcelIds((prev) => Array.from(new Set([...prev, ...shownIds])));
                                } else {
                                  const shownIds = new Set(filteredDispatchParcels.map((p) => p.id));
                                  setSelectedCourierParcelIds((prev) => prev.filter((id) => !shownIds.has(id)));
                                }
                              }}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                            />
                          </th>
                          <th className="py-2.5 px-3">رقم البوليصة والتتبع</th>
                          <th className="py-2.5 px-3">المستلم والاتصال</th>
                          <th className="py-2.5 px-3">وجهة التسليم والعنوان</th>
                          <th className="py-2.5 px-3">مواصفات الطرد</th>
                          <th className="py-2.5 px-3">طريقة السداد</th>
                          <th className="py-2.5 px-3">المبالغ المالية المقيدة</th>
                          <th className="py-2.5 px-3">وصول المستودع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredDispatchParcels.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                              {warehouseReadyParcels.length === 0
                                ? 'لا توجد طرود بالمستودع بانتظار الإسناد للموزعين حالياً'
                                : 'لا توجد طرود مطابقة لمعايير البحث والتصفية'}
                            </td>
                          </tr>
                        ) : (
                          filteredDispatchParcels.map((parcel) => {
                            const isSelected = selectedCourierParcelIds.includes(parcel.id);

                            return (
                              <tr
                                key={parcel.id}
                                onClick={() => {
                                  setSelectedCourierParcelIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== parcel.id) : [...prev, parcel.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-950/30 hover:bg-emerald-950/40 border-r-4 border-emerald-500'
                                    : 'hover:bg-slate-900/60'
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCourierParcelIds((prev) => [...prev, parcel.id]);
                                      } else {
                                        setSelectedCourierParcelIds((prev) => prev.filter((id) => id !== parcel.id));
                                      }
                                    }}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                                  />
                                </td>

                                {/* Tracking & Receipt */}
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                                    <span>{parcel.trackingNumber}</span>
                                    {parcel.paperReceiptNumber && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                                        ورقي: {parcel.paperReceiptNumber}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <span>{parcel.packageType || 'طرد'}</span>
                                    {parcel.piecesCount && parcel.piecesCount > 1 && <span>• {parcel.piecesCount} قطع</span>}
                                  </div>
                                </td>

                                {/* Receiver */}
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="font-bold text-white text-xs">{parcel.receiver.name}</div>
                                  <div className="text-[11px] text-emerald-400 font-mono" dir="ltr">
                                    {parcel.receiver.phone}
                                  </div>
                                </td>

                                {/* Destination Address */}
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="text-slate-300 font-medium text-xs">
                                    {parcel.receiver.city || 'المدينة'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 max-w-[200px] truncate" title={parcel.receiver.address}>
                                    {parcel.receiver.address || '-'}
                                  </div>
                                </td>

                                {/* Specs */}
                                <td className="py-2.5 px-3 align-middle">
                                  <div className="text-[11px] text-slate-300 font-mono">
                                    {parcel.weightKg || 1} كغ • {parcel.piecesCount || 1} طرد
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={parcel.contentDescription}>
                                    {parcel.contentDescription || 'بضائع عامة'}
                                  </div>
                                </td>

                                {/* Payment Type */}
                                <td className="py-2.5 px-3 align-middle">
                                  {parcel.paymentType === 'cod' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                                      ضد الدفع (COD)
                                    </span>
                                  ) : parcel.paymentType === 'collect' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
                                      شحن على المستلم
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 whitespace-nowrap">
                                      مدفوع سلفاً
                                    </span>
                                  )}
                                </td>

                                {/* Financial Dues */}
                                <td className="py-2.5 px-3 align-middle">
                                  {(() => {
                                    const s = getParcelPaymentSummary(parcel);
                                    if (s.normalizedType === 'cod' && !s.isSameCurrency) {
                                      return (
                                        <div className="space-y-0.5 font-mono">
                                          <div className="font-bold text-amber-400 text-xs">
                                            حوالة: {formatCurrency(s.totalCodDue, s.codCurrency)}
                                          </div>
                                          <div className={`text-[10px] ${s.isShippingPrepaidBySender ? 'text-cyan-300' : 'text-emerald-400 font-semibold'}`}>
                                            شحن: {formatCurrency(s.shippingCost, s.shippingCurrency)} {s.isShippingPrepaidBySender && '(مسدد)'}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="font-mono font-bold text-emerald-400 text-xs">
                                        {s.summaryDueText}
                                      </div>
                                    );
                                  })()}
                                </td>

                                {/* Arrival Time */}
                                <td className="py-2.5 px-3 align-middle text-[10px] text-slate-400 font-mono">
                                  {parcel.createdAt ? new Date(parcel.createdAt).toLocaleDateString('ar-SY') : '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Active Courier Manifests List with Instant Custody Settlement Modal Trigger */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm sm:text-base font-black text-white">
                  منافيست التوزيع والعهد النشطة في الميدان ({activeCourierManifests.length})
                </h2>
                <span className="text-[11px] text-slate-400">
                  الجولات الميدانية الحالية ومطابقة التسليم واستلام المبالغ
                </span>
              </div>
            </div>

            {activeCourierManifests.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                لا توجد جولات توزيع نشطة حالياً مع الموزعين
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCourierManifests.map((mnf) => {
                  const courier = users.find((u) => u.id === mnf.courierId);
                  const mnfParcels = parcels.filter((p) => mnf.parcelIds.includes(p.id));

                  // Calculate total COD & freight for this manifest using unified settlement math
                  let totalCustodySyp = 0;
                  let totalCustodyUsd = 0;
                  mnfParcels.forEach((p) => {
                    const item = calculateParcelReceivable(p);
                    if (item.currency === 'USD') {
                      totalCustodyUsd += item.totalReceivable;
                    } else {
                      totalCustodySyp += item.totalReceivable;
                    }
                  });

                  return (
                    <div
                      key={mnf.id}
                      className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-md"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-300 font-mono text-sm">
                              {mnf.manifestNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                              في عهدة الموزع
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(mnf.assignedAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 p-2 bg-slate-900/80 rounded-xl border border-slate-800/80">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                            {courier?.name ? courier.name.charAt(0) : 'م'}
                          </div>
                          <div>
                            <div className="text-xs text-white font-bold">{courier?.name || 'موزع معتمد'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{courier?.phone}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">إجمالي الطرود</div>
                            <div className="font-bold font-mono text-white mt-0.5">{mnf.parcelIds.length} طرد</div>
                          </div>
                          <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400">العهدة النقدية المطلوبة</div>
                            <div className="font-bold font-mono text-emerald-400 mt-0.5">
                              {formatCurrency(totalCustodySyp || 0, 'SYP')}
                              {totalCustodyUsd > 0 && ` + ${formatCurrency(totalCustodyUsd, 'USD')}`}
                            </div>
                          </div>
                        </div>

                        {mnf.notes && (
                          <div className="text-[11px] text-slate-400 italic bg-slate-900/40 px-2.5 py-1 rounded border border-slate-800/50">
                            {mnf.notes}
                          </div>
                        )}
                      </div>

                      {/* Actions: Print Manifest & Settle Custody */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            openPrintModal('manifest_a4', {
                              id: mnf.id,
                              manifestNumber: mnf.manifestNumber,
                              originHubId: currentBranch.id,
                              destinationHubId: currentBranch.id,
                              driverName: courier?.name || 'الموزع',
                              driverPhone: courier?.phone || '',
                              truckPlate: courier?.nationalId || 'موزع محلي',
                              truckType: 'دراجة توزيع / شاحنة صغيرة',
                              status: 'dispatched',
                              createdById: currentUser.id,
                              parcelIds: mnf.parcelIds,
                              createdAt: mnf.assignedAt,
                              dispatchedAt: mnf.assignedAt,
                              totalPieces: mnf.parcelIds.length,
                              totalWeightKg: 0,
                              totalFreightSyp: 0,
                              totalFreightUsd: 0,
                              totalCodSyp: totalCustodySyp,
                              totalCodUsd: totalCustodyUsd,
                              notes: mnf.notes,
                              isCourierManifest: true,
                              courierId: mnf.courierId,
                              courierName: courier?.name,
                              courierPhone: courier?.phone,
                            });
                          }}
                          className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm cursor-pointer shrink-0"
                          title="طباعة مانافيست الموزع (A4)"
                        >
                          <Printer className="w-4 h-4 text-emerald-400" />
                          <span>طباعة المانافيست</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettlingManifest(mnf)}
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 whitespace-nowrap ring-1 ring-emerald-400/40"
                        >
                          <DollarSign className="w-4 h-4 text-emerald-200" />
                          <span>تصفية العهدة واستلام المبالغ ◄</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Registered Authorized Couriers Registry Section */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  سجل الموزعين المعتمدين وبياناتهم ({couriersList.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  قائمة المناديب والموزعين المسجلين في النظام لتسليم الطرود والعهد
                </span>
              </div>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAddCourierModal}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md active:scale-95 shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة موزع معتمد جديد</span>
                </button>
              )}
            </div>

            {couriersList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                لا يوجد موزعون معتمدون مسجلون حالياً. انقر على «إضافة موزع معتمد» لتسجيل أول موزع.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {couriersList.map((courier) => {
                  const isSelected = courier.id === selectedCourierId;
                  return (
                    <div
                      key={courier.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                              {courier.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs">{courier.name}</div>
                              <div className="text-[10px] text-emerald-400 font-bold">موزع معتمد</div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              courier.isActive
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {courier.isActive ? 'نشط' : 'غير نشط'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>الهاتف:</span>
                            <span className="font-mono text-white font-bold">{courier.phone}</span>
                          </div>
                          {courier.nationalId && (
                            <div className="flex items-center justify-between text-slate-400">
                              <span>الرقم الوطني:</span>
                              <span className="font-mono text-slate-200">{courier.nationalId}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourierId(courier.id);
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ الموزع المختار حالياً' : 'اختيار لمانافيست التوزيع ◄'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COURIER INTAKE AUDIT & COMBINED CASHBOX SETTLEMENT                 */}
      {/* (تدقيق واستلام طرود الموزعين الميدانية وترصيد صندوق المقبوضات المعزول)    */}
      {/* ========================================================================= */}
      {activeTab === 'courier_intake_audit' && (
        <div className="space-y-4">
          
          {/* Success Banner */}
          {auditSuccessNotice && (
            <div className="p-4 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold">{auditSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuditSuccessNotice(null)}
                className="text-emerald-400 hover:text-white font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Header & Overall KPIs */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  <span>تدقيق واستلام طرود الموزعين وترصيد صندوق المقبوضات الميدانية</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  مطابقة فيزيائية ومسح باركود للطرود المسجلة من قبل الموزعين في الميدان وتوريد مقبوضات الشحن المسبقة فورياً لخزينة الفرع
                </p>
              </div>

              {/* Sub-tab navigation */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIntakeAuditSubTab('audit_desk')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    intakeAuditSubTab === 'audit_desk'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>جلسة التدقيق والاستلام</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeAuditSubTab('settlement_history')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    intakeAuditSubTab === 'settlement_history'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>أرشيف السندات ({branchIntakeVouchers.length})</span>
                </button>
              </div>
            </div>

            {/* Branch Level KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">الطرود المسجلة قيد التدقيق:</span>
                <span className="font-mono text-base font-black text-amber-300">
                  {totalUnsettledIntakeParcelsCount} <span className="text-xs font-normal">طرد</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">موزعون بحوزتهم طرود:</span>
                <span className="font-mono text-base font-black text-white">
                  {totalPendingCouriersIntakeCount} <span className="text-xs font-normal">موزع</span>
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي المقبوضات المعلقة (ل.س):</span>
                <span className="font-mono text-base font-black text-amber-400">
                  {formatCurrency(totalPendingIntakeSyp, 'SYP')}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">المقبوضات المعلقة ($):</span>
                <span className="font-mono text-base font-black text-emerald-400">
                  {formatCurrency(totalPendingIntakeUsd, 'USD')}
                </span>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* SUB-TAB 1: AUDIT DESK & HANDOVER                                       */}
          {/* ===================================================================== */}
          {intakeAuditSubTab === 'audit_desk' && (
            <div className="space-y-4">
              
              {/* STEP 1: SELECT COURIER */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-amber-400" />
                    <span>اختر الموزع للبدء بتدقيق طروده وترصيد صندوقه:</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    يظهر الموزعون التابعون للفرع الحالي
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {couriersWithIntake.map((item) => {
                    const isSelected = selectedIntakeCourierId === item.courier.id;
                    const hasPending = item.financials.unsettledParcels.length > 0;

                    return (
                      <button
                        key={item.courier.id}
                        type="button"
                        onClick={() => setSelectedIntakeCourierId(item.courier.id)}
                        className={`p-3 rounded-2xl border text-right transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/10'
                            : hasPending
                            ? 'bg-slate-950/90 border-amber-500/40 hover:border-amber-400'
                            : 'bg-slate-950/50 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-xs truncate">{item.courier.name}</span>
                            {hasPending && (
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono">{item.courier.phone || item.courier.username}</span>
                          <span className="text-[10px] text-amber-300 font-bold block">
                            المقبوضات: {formatCurrency(item.financials.totalPrepaidSyp, 'SYP')}
                          </span>
                        </div>

                        <div className="text-left shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold block ${
                              hasPending
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.financials.unsettledParcels.length} طرود
                          </span>
                          {isSelected && (
                            <span className="text-[9px] text-amber-400 font-bold block mt-1">✓ المختار</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: ACTIVE COURIER INTAKE AUDIT DESK */}
              {activeAuditCourierItem ? (
                <div className="bg-slate-900/85 backdrop-blur-md border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                  {/* Courier Title & Barcode Scanner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white">{activeAuditCourierItem.courier.name}</h3>
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold">
                            جلسة استلام وترصيد
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          هاتف: {activeAuditCourierItem.courier.phone || 'غير مسجل'} • الفرع: {currentBranch.name}
                        </p>
                      </div>
                    </div>

                    {/* Barcode scanner input */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <ScanLine className="w-4 h-4 text-amber-400 absolute right-3 top-2.5" />
                        <input
                          ref={intakeBarcodeRef}
                          type="text"
                          value={auditBarcodeQuery}
                          onChange={(e) => setAuditBarcodeQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleIntakeBarcodeScan(auditBarcodeQuery);
                            }
                          }}
                          placeholder="مسح باركود الطرد بالماسح الضوئي..."
                          className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleIntakeBarcodeScan(auditBarcodeQuery)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        مسح
                      </button>
                    </div>
                  </div>

                  {/* Audit Selection Controls & Real-time Totals */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAuditParcelIds(
                            activeAuditCourierItem.financials.unsettledParcels.map((p) => p.id)
                          )
                        }
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[11px] transition cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAuditParcelIds([])}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg font-bold text-[11px] transition cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                      <span className="text-slate-400 mr-2">
                        المحدد للتدقيق: <span className="font-bold text-white font-mono">{selectedAuditParcelIds.length}</span> من أصل <span className="font-bold text-amber-300 font-mono">{activeAuditCourierItem.financials.unsettledParcels.length}</span> طرد
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">المبلغ المستلم نقداً (ل.س):</span>
                        <span className="font-mono text-sm font-black text-amber-300">
                          {formatCurrency(auditedTotals.syp, 'SYP')}
                        </span>
                      </div>
                      {auditedTotals.usd > 0 && (
                        <div className="border-r border-slate-800 pr-3">
                          <span className="text-[10px] text-slate-400 block font-bold">المبلغ بالدولار ($):</span>
                          <span className="font-mono text-sm font-black text-emerald-400">
                            {formatCurrency(auditedTotals.usd, 'USD')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Parcels Table */}
                  {activeAuditCourierItem.financials.unsettledParcels.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                      <span>لا توجد طرود معلقة بحوزة هذا الموزع حالياً، تم تدقيق وتوريد كافة الطرود السابقة.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-bold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">تدقيق</th>
                            <th className="py-2.5 px-3">رقم البوليصة</th>
                            <th className="py-2.5 px-3">الوجهة</th>
                            <th className="py-2.5 px-3">المرسل</th>
                            <th className="py-2.5 px-3">المستلم</th>
                            <th className="py-2.5 px-3 text-center">الوزن / القطع</th>
                            <th className="py-2.5 px-3 text-center">نوع الدفع</th>
                            <th className="py-2.5 px-3 text-left">أجور الشحن (المقبوضة سلفاً)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-[11px]">
                          {activeAuditCourierItem.financials.unsettledParcels.map((parcel) => {
                            const isChecked = selectedAuditParcelIds.includes(parcel.id);
                            const isPrepaid =
                              parcel.paymentType === 'prepaid' ||
                              (parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender');
                            const destBranch = branches.find((b) => b.id === parcel.destinationHubId);

                            return (
                              <tr
                                key={parcel.id}
                                className={`transition ${
                                  isChecked ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'bg-slate-950/40 hover:bg-slate-900/60'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAuditParcelIds((prev) => [...prev, parcel.id]);
                                      } else {
                                        setSelectedAuditParcelIds((prev) => prev.filter((id) => id !== parcel.id));
                                      }
                                    }}
                                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-bold text-amber-300 block">{parcel.trackingNumber}</span>
                                  {parcel.paperReceiptNumber && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      وصل: {parcel.paperReceiptNumber}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-white block">{destBranch?.name || parcel.destinationHubId}</span>
                                  <span className="text-[10px] text-slate-400">{destBranch?.governorate || ''}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-slate-200 block">{parcel.sender.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{parcel.sender.phone}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-slate-200 block">{parcel.receiver.name}</span>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">
                                    {parcel.destinationAddress}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="font-mono">{parcel.weightKg} كغ</span>
                                  <span className="text-[10px] text-slate-400 block">{parcel.piecesCount} طرد</span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isPrepaid ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {isPrepaid ? 'مدفوع سلفاً' : 'تحصيل وجهة'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-left font-mono font-bold">
                                  {isPrepaid ? (
                                    <span className="text-amber-300 font-black">
                                      {formatCurrency(parcel.shippingCost, parcel.currency)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">0 (تحصيل عند التسليم)</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Settlement Action Bar */}
                  {activeAuditCourierItem.financials.unsettledParcels.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border-2 border-amber-500/40 p-4 rounded-2xl space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 block mb-1">
                          ملاحظات التدقيق والاستلام (اختياري):
                        </label>
                        <input
                          type="text"
                          value={auditNotes}
                          onChange={(e) => setAuditNotes(e.target.value)}
                          placeholder="مثال: تم فحص البضائع ومطابقة الأختام وتوريد المبالغ نقداً باليد..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <div className="text-xs text-slate-300">
                          <span>سيتم إدخال الطرود لمستودع الفرع وتوريد </span>
                          <span className="font-mono font-black text-amber-400">
                            {formatCurrency(auditedTotals.syp, 'SYP')}
                            {auditedTotals.usd > 0 ? ` + ${formatCurrency(auditedTotals.usd, 'USD')}` : ''}
                          </span>
                          <span> إلى خزينة الفرع وتصفير صندوق مقبوضات الموزع فورياً.</span>
                        </div>

                        <button
                          type="button"
                          disabled={selectedAuditParcelIds.length === 0}
                          onClick={() => {
                            if (!selectedIntakeCourierId || selectedAuditParcelIds.length === 0) return;
                            const newVch = settleCourierIntakeParcels(
                              selectedIntakeCourierId,
                              selectedAuditParcelIds,
                              auditNotes
                            );
                            setAuditNotes('');
                            setAuditSuccessNotice(
                              `تم تدقيق واستلام (${newVch.parcelsCount}) طرد بنجاح بموجب السند [${newVch.voucherNumber}] وتوريد المبالغ لخزينة الفرع!`
                            );
                            openCourierIntakeVoucherPrint(newVch);
                          }}
                          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            تأكيد استلام الطرود ({selectedAuditParcelIds.length}) وتوريد المقبوضات لخزينة الفرع
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <span>يرجى اختيار موزع من القائمة أعلاه لبدء تدقيق الطرود ومطابقة المقبوضات النقدية.</span>
                </div>
              )}

            </div>
          )}

          {/* ===================================================================== */}
          {/* SUB-TAB 2: SETTLEMENT VOUCHERS ARCHIVE                                */}
          {/* ===================================================================== */}
          {intakeAuditSubTab === 'settlement_history' && (
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>سجل وأرشيف سندات توريد مقبوضات تسجيل الطرود</span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    كافة السندات المالية الصادرة عند ترصيد واستلام طرود الموزعين الميدانية
                  </p>
                </div>
              </div>

              {branchIntakeVouchers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <span>لا توجد سندات ترصيد مقبوضات سابقة مسجلة حتى الآن.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">رقم السند</th>
                        <th className="py-2.5 px-3">اسم الموزع</th>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3">مدقق الاستلام</th>
                        <th className="py-2.5 px-3 text-center">عدد الطرود</th>
                        <th className="py-2.5 px-3 text-left">المبلغ المورد (ل.س)</th>
                        <th className="py-2.5 px-3 text-left">المبلغ بالدولار ($)</th>
                        <th className="py-2.5 px-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[11px]">
                      {branchIntakeVouchers.map((voucher) => (
                        <tr key={voucher.id} className="bg-slate-950/40 hover:bg-slate-900/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                            {voucher.voucherNumber}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            {voucher.courierName}
                            {voucher.courierPhone && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {voucher.courierPhone}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                            {new Date(voucher.timestamp).toLocaleDateString('ar-SY')} - {new Date(voucher.timestamp).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {voucher.receivedByUserName}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                            {voucher.parcelsCount} طرد
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-black text-white">
                            {formatCurrency(voucher.totalPrepaidSyp, 'SYP')}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-400">
                            {voucher.totalPrepaidUsd > 0 ? `$${voucher.totalPrepaidUsd}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => openCourierIntakeVoucherPrint(voucher)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>طباعة السند</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* TAB 4: COURIER RETURNS PENDING INTAKE */}
      {activeTab === 'courier_returns_pending' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>المرتجعات من الموزعين - بانتظار استلامك الفعلي ({courierReturnsPending.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                الطرود المعادة من جولات التوزيع. اضغط استلام لإسقاط العهدة عن الموزع وتثبيتها في المستودع.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                  <th className="py-2.5 px-3 font-semibold">الموزع المعيد</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم وهاتفه</th>
                  <th className="py-2.5 px-3 font-semibold">سبب الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">التوقيت</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ المطلوب</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {courierReturnsPending.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500 text-xs">
                      لا توجد طرود مرتجعة معلقة بانتظار استلامك حالياً
                    </td>
                  </tr>
                ) : (
                  courierReturnsPending.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                        {parcel.trackingNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-amber-300">
                        {parcel.returnedByUserName || parcel.assignedCourierName || 'الموزع'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-200">{parcel.receiver.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.receiver.phone}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          {parcel.returnReason || 'غير محدد'}
                        </span>
                        {parcel.returnNotes && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{parcel.returnNotes}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {parcel.returnedAt ? new Date(parcel.returnedAt).toLocaleString('ar-SY') : 'اليوم'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        {formatCurrency(parcel.totalDue || 0, parcel.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            receiveReturnedParcelAtBranch(parcel.id, currentBranch?.id || parcel.destinationHubId);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 mx-auto transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>استلام للمستودع</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW AUTHORIZED COURIER */}
      <CourierCardModal
        isOpen={isAddCourierModalOpen}
        onClose={() => setIsAddCourierModalOpen(false)}
        defaultBranchId={currentBranch.id}
        onSaveSuccess={(created) => {
          setSelectedCourierId(created.id);
          setNewCourierNotice(
            `تم تسجيل الموزع المعتمد «${created.name}» مع تعيين اسم المستخدم [${created.username}] بكلمة مرور [${created.password || '12345'}] بنجاح واختياره مباشرة.`
          );
          setTimeout(() => setNewCourierNotice(null), 7000);
        }}
      />

      {/* DIALOG: DIRECT DELIVERY + SYRIAN NATIONAL ID SCANNER & PHOTO (EXPANDED LANDSCAPE) */}
      {selectedParcelForDelivery && (
        <DeliveryHandoverModal
          parcel={selectedParcelForDelivery}
          onClose={() => setSelectedParcelForDelivery(null)}
          onConfirm={(deliveryData) => {
            const res = deliverParcel(
              selectedParcelForDelivery.id,
              deliveryData.nationalId,
              deliveryData.idPhotoUrl,
              deliveryData.collectedAmount,
              deliveryData.deliveryNotes,
              {
                actualReceiverName: deliveryData.actualReceiverName,
                receiverRelation: deliveryData.receiverRelation,
                idBackPhotoUrl: deliveryData.idBackPhotoUrl,
                idMotherName: deliveryData.idMotherName,
                idFatherName: deliveryData.idFatherName,
                idBirthPlace: deliveryData.idBirthPlace,
                idCivilRecord: deliveryData.idCivilRecord,
                idType: deliveryData.idType,
                signatureUrl: deliveryData.signatureUrl,
                collectedSyp: deliveryData.collectedSyp,
                collectedUsd: deliveryData.collectedUsd,
                receiverPhone: deliveryData.receiverPhone,
                receiverBirthDate: deliveryData.receiverBirthDate,
                receiverFirstName: deliveryData.receiverFirstName,
                receiverLastName: deliveryData.receiverLastName,
              }
            );

            if (res && res.success === false) {
              setScanFeedbackNotice({
                type: 'error',
                message: res.error || 'تعذر تسليم الطرد',
              });
              setDeliverySuccessMessage(null);
              setSelectedParcelForDelivery(null);
              return;
            }

            setDeliverySuccessMessage(
              `تم تسليم الشحنة (${selectedParcelForDelivery.trackingNumber}) بنجاح للمستلم [${
                deliveryData.actualReceiverName || selectedParcelForDelivery.receiver.name
              }] وتوثيق الهوية وإيداع المقبوضات في الصندوق!`
            );
            setSelectedParcelForDelivery(null);
          }}
        />
      )}

      {/* DIALOG: COURIER CUSTODY SETTLEMENT & CASH RECONCILIATION MODAL */}
      {settlingManifest && (
        <CourierCustodySettlementModal
          manifest={settlingManifest}
          courier={users.find((u) => u.id === settlingManifest.courierId)}
          currentBranch={currentBranch}
          parcels={parcels}
          onClose={() => setSettlingManifest(null)}
          onConfirmSettlement={(settlementData) => {
            settleCourierManifest(
              settlingManifest.id,
              settlementData.deliveredIds,
              settlementData.returnedIds,
              {
                collectedSyp: settlementData.collectedSyp,
                collectedUsd: settlementData.collectedUsd,
                courierCommissionSyp: 0,
                netDepositedSyp: settlementData.netDepositedSyp,
                netDepositedUsd: settlementData.netDepositedUsd,
                uncollectedIds: settlementData.uncollectedIds,
                uncollectedSyp: settlementData.uncollectedSyp,
                uncollectedUsd: settlementData.uncollectedUsd,
                returnReasons: settlementData.returnReasons,
                notes: settlementData.notes,
              }
            );
            const isCredit = (settlementData.uncollectedIds?.length || 0) > 0;
            setDeliverySuccessMessage(
              isCredit
                ? `تمت تصفية عهدة الموزع كـ (مستند معلق ذمة)! مسلّم ومقبوض (${settlementData.deliveredIds.length})، تسليم بدون قبض (${settlementData.uncollectedIds?.length}) بقيمة معلقة (${formatCurrency(settlementData.uncollectedSyp || 0, 'SYP')})، وإرجاع (${settlementData.returnedIds.length}) للمستودع.`
                : `تمت تصفية عهدة الموزع نهائياً! تم اعتماد تسليم (${settlementData.deliveredIds.length}) طرد، وإرجاع (${settlementData.returnedIds.length}) طرد لمستودع الفرع، وتوريد الصافي المقبوض (${formatCurrency(settlementData.netDepositedSyp || 0, 'SYP')}) إلى صندوق الفرع بسند مالي رسمي.`
            );
            setSettlingManifest(null);
          }}
        />
      )}
    </div>
  );
};
