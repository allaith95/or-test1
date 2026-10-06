import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOrca } from '../context/OrcaContext';
import {
  blockNonPhoneKeys,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  Truck,
  Package,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  X,
  AlertCircle,
  ShieldCheck,
  FileText,
  Printer,
  User,
  Phone,
  MapPin,
  Scale,
  Boxes,
  Barcode,
  CheckSquare,
  Square,
  Info,
  Check,
  Coins,
  Plus,
} from 'lucide-react';
import { Parcel, TruckManifest, Vehicle, VehicleType } from '../types';
import { getVisibleBranches } from '../utils/branchHelper';
import { getParcelPaymentSummary, normalizeParcelPaymentType } from '../utils/settlementMath';
import { formDraftStorage } from '../utils/formDraftStorage';
import { safeStorage } from '../utils/storage';
import { extractCleanTrackingQuery } from '../utils/BarcodeScannerUtility';

interface CreateManifestFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifestToEdit?: TruckManifest | null;
}

export const CreateManifestFullscreenModal: React.FC<CreateManifestFullscreenModalProps> = ({
  isOpen,
  onClose,
  manifestToEdit,
}) => {
  const {
    currentBranch,
    branches,
    parcels,
    truckManifests,
    vehicles,
    addVehicle,
    createTruckManifest,
    updateTruckManifest,
    openPrintModal,
    currentUser,
    formatCurrency,
    formatNumber,
    formatQuantity,
    ensureServerConnected,
  } = useOrca();

  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewSuccessNotice, setPreviewSuccessNotice] = useState<string | null>(null);

  // Destination hubs: ONLY main hubs (type === 'main_hub'), strictly excluding current branch & parent hub
  const destHubs = useMemo(() => {
    return branches.filter((b) => {
      // Must be a main hub only
      if (b.type !== 'main_hub') return false;
      // Strictly do not show current origin branch from which manifest is sent
      if (b.id === currentBranch.id) return false;
      // If current branch is a collection sub-branch, also exclude its parent hub
      if (currentBranch.parentHubId && b.id === currentBranch.parentHubId) return false;
      return true;
    });
  }, [branches, currentBranch]);

  const [destinationHubId, setDestinationHubId] = useState<string>(() =>
    destHubs.length > 0 ? destHubs[0].id : ''
  );

  // Keep destinationHubId synced if destHubs list changes
  React.useEffect(() => {
    if (destHubs.length > 0 && (!destinationHubId || !destHubs.some((h) => h.id === destinationHubId))) {
      setDestinationHubId(destHubs[0].id);
    }
  }, [destHubs, destinationHubId]);

  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [truckType, setTruckType] = useState('شاحنة مرسيدس صندوق مغلق 10 طن');
  const [securitySealNumber, setSecuritySealNumber] = useState('');
  const [manifestNotes, setManifestNotes] = useState('');

  // Vehicle directory selection and inline creation state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [showNewVehicleModal, setShowNewVehicleModal] = useState<boolean>(false);
  const [newVehicleForm, setNewVehicleForm] = useState<{
    plateNumber: string;
    driverName: string;
    driverPhone: string;
    type: VehicleType;
    model: string;
    maxWeightKg: number;
    ownership: 'company' | 'contractor';
  }>({
    plateNumber: '',
    driverName: '',
    driverPhone: '',
    type: 'شاحنة متوسطة (دينا)',
    model: '',
    maxWeightKg: 5000,
    ownership: 'company',
  });
  const [newVehicleError, setNewVehicleError] = useState<string | null>(null);

  // Selected Parcel IDs
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);

  // Filtering and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'prepaid' | 'collect'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'SYP' | 'USD'>('all');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeNotification, setBarcodeNotification] = useState<string | null>(null);

  // Draft Form Storage Key & Recovery State
  const DRAFT_KEY = `truck_manifest_${currentBranch.id}`;
  const [draftPrompt, setDraftPrompt] = useState<{ savedAt: string; data: any } | null>(null);

  // Populate form fields when manifestToEdit changes or reset when opening new manifest
  React.useEffect(() => {
    if (isOpen) {
      if (manifestToEdit) {
        setDestinationHubId(manifestToEdit.destinationHubId);
        setDriverName(manifestToEdit.driverName || '');
        setDriverPhone(manifestToEdit.driverPhone || '');
        setTruckPlate(manifestToEdit.truckPlate || '');
        setTruckType(manifestToEdit.truckType || 'شاحنة مرسيدس صندوق مغلق 10 طن');
        setSecuritySealNumber('');
        setManifestNotes(manifestToEdit.notes || '');
        setSelectedParcelIds(Array.from(new Set(manifestToEdit.parcelIds || [])));
        setSelectedVehicleId('');
        setValidationError(null);
        setPreviewSuccessNotice(null);
      } else {
        // تفريغ البيانات السابقة بالكامل وفتح إدراج بيانات جديدة كلياً
        setDestinationHubId(destHubs.length > 0 ? destHubs[0].id : '');
        setDriverName('');
        setDriverPhone('');
        setTruckPlate('');
        setTruckType('شاحنة مرسيدس صندوق مغلق 10 طن');
        setSecuritySealNumber('');
        setManifestNotes('');
        setSelectedParcelIds([]);
        setSelectedVehicleId('');
        setSearchQuery('');
        setPaymentFilter('all');
        setCurrencyFilter('all');
        setSelectionFilter('all');
        setBarcodeInput('');
        setBarcodeNotification(null);
        setValidationError(null);
        setPreviewSuccessNotice(null);
        setDraftPrompt(null);
        formDraftStorage.clearDraft(DRAFT_KEY);
      }
    }
  }, [isOpen, manifestToEdit, DRAFT_KEY, destHubs]);

  // Selected destination hub object
  const selectedDestHub = branches.find((b) => b.id === destinationHubId);

  // Base available parcels at current branch (not already on another manifest or delivered)
  const availableParcels = useMemo(() => {
    const knownManifestIds = new Set<string>();
    for (const m of truckManifests) {
      if (m.id) knownManifestIds.add(m.id);
      if (m.manifestNumber) knownManifestIds.add(m.manifestNumber);
    }
    return parcels.filter((p) => {
      // 0. Reverse shipments heading back to their origin branch
      const isReverseAtBranch =
        p.isReverseShipment &&
        (p.handlingStatus === 'returning_to_origin' || p.handlingStatus === 'return_initiated') &&
        (!currentBranch?.id || p.currentLocationBranchId === currentBranch.id || p.destinationHubId === currentBranch.id);

      if (isReverseAtBranch) {
        return (
          !p.truckManifestId ||
          !knownManifestIds.has(p.truckManifestId) ||
          (manifestToEdit &&
            (p.truckManifestId === manifestToEdit.id ||
              p.truckManifestId === manifestToEdit.manifestNumber)) ||
          (manifestToEdit && manifestToEdit.parcelIds.includes(p.id))
        );
      }

      // 1. Origin hub / branch matching
      const matchesOrigin =
        !currentBranch?.id ||
        p.originHubId === currentBranch.id ||
        p.originCollectionBranchId === currentBranch.id ||
        p.originBranchId === currentBranch.id ||
        p.currentLocationBranchId === currentBranch.id ||
        (currentBranch.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id === p.originCollectionBranchId || b.id === p.originBranchId || b.id === p.currentLocationBranchId) &&
              b.parentHubId === currentBranch.id
          ));

      if (!matchesOrigin) return false;

      // 2. Handling status: must be ready in the warehouse
      const isStatusReady =
        (p.handlingStatus === 'received_at_hub' ||
         p.handlingStatus === 'received_at_origin_hub' ||
         p.handlingStatus === 'leftover_origin_warehouse' ||
         p.handlingStatus === 'loaded_in_truck' ||
         p.handlingStatus === 'in_transit') &&
        !p.isReverseShipment;

      if (!isStatusReady) return false;

      // 3. Manifest attachment status
      return (
        !p.truckManifestId ||
        !knownManifestIds.has(p.truckManifestId) ||
        (manifestToEdit &&
          (p.truckManifestId === manifestToEdit.id ||
            p.truckManifestId === manifestToEdit.manifestNumber)) ||
        (manifestToEdit && manifestToEdit.parcelIds.includes(p.id))
      );
    });
  }, [parcels, currentBranch, branches, manifestToEdit, truckManifests]);

  const restoreDraft = () => {
    if (!draftPrompt?.data) return;
    const d = draftPrompt.data;
    if (d.destinationHubId) setDestinationHubId(d.destinationHubId);
    if (d.driverName) setDriverName(d.driverName);
    if (d.driverPhone) setDriverPhone(d.driverPhone);
    if (d.truckPlate) setTruckPlate(d.truckPlate);
    if (d.truckType) setTruckType(d.truckType);
    if (d.securitySealNumber) setSecuritySealNumber(d.securitySealNumber);
    if (d.manifestNotes) setManifestNotes(d.manifestNotes);
    if (Array.isArray(d.selectedParcelIds)) setSelectedParcelIds(d.selectedParcelIds);
    setPreviewSuccessNotice('✓ تم استرجاع مسودة المانافيست السابقة بنجاح');
    setDraftPrompt(null);
    setTimeout(() => setPreviewSuccessNotice(null), 3500);
  };

  const discardDraft = () => {
    formDraftStorage.clearDraft(DRAFT_KEY);
    setDraftPrompt(null);
  };

  // Auto-save draft on changes when open
  React.useEffect(() => {
    if (!isOpen) return;
    if (driverName || driverPhone || truckPlate || securitySealNumber || manifestNotes || selectedParcelIds.length > 0) {
      formDraftStorage.saveDraft(DRAFT_KEY, {
        destinationHubId,
        driverName,
        driverPhone,
        truckPlate,
        truckType,
        securitySealNumber,
        manifestNotes,
        selectedParcelIds,
      });
    }
  }, [
    isOpen,
    DRAFT_KEY,
    destinationHubId,
    driverName,
    driverPhone,
    truckPlate,
    truckType,
    securitySealNumber,
    manifestNotes,
    selectedParcelIds,
  ]);

  // Destination-specific parcels: strictly filtered to selected destination main hub (or sub-branches linked to it)
  const destinationParcels = useMemo(() => {
    if (!destinationHubId) return [];
    return availableParcels.filter((p) => {
      if (p.isReverseShipment) {
        return p.originHubId === destinationHubId;
      }
      if (p.destinationHubId === destinationHubId) return true;
      const targetBranch = branches.find((b) => b.id === p.destinationHubId);
      return targetBranch && targetBranch.parentHubId === destinationHubId;
    });
  }, [availableParcels, destinationHubId, branches]);

  // وعند تغيير الوجهة يتم تنقية الطرود المحددة لمنع أي تضارب في الوجهات
  React.useEffect(() => {
    if (destinationHubId) {
      setSelectedParcelIds((prev) =>
        prev.filter((id) => destinationParcels.some((p) => p.id === id))
      );
    }
  }, [destinationHubId, destinationParcels]);

  // Vehicle directory handler
  const handleSelectVehicleFromDirectory = (vId: string) => {
    setSelectedVehicleId(vId);
    if (!vId) return;
    const v = vehicles.find((x) => x.id === vId);
    if (v) {
      setTruckPlate(v.plateNumber);
      setDriverName(v.driverName);
      setDriverPhone(v.driverPhone || '');
      setTruckType(v.type || v.model || 'شاحنة نقل');
      setPreviewSuccessNotice(`✓ تم جلب بيانات المركبة (${v.plateNumber}) والسائق (${v.driverName}) من دليل الأسطول`);
      setTimeout(() => setPreviewSuccessNotice(null), 3500);
    }
  };

  // Inline vehicle registration handler
  const handleCreateNewVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleForm.plateNumber.trim()) {
      setNewVehicleError('يرجى إدخال رقم لوحة المركبة / الشاحنة');
      return;
    }
    if (!newVehicleForm.driverName.trim()) {
      setNewVehicleError('يرجى إدخال اسم السائق المعتمد');
      return;
    }
    if (!newVehicleForm.driverPhone.trim()) {
      setNewVehicleError('يرجى إدخال رقم هاتف السائق للتواصل');
      return;
    }

    const createdVeh = addVehicle({
      plateNumber: newVehicleForm.plateNumber.trim(),
      driverName: newVehicleForm.driverName.trim(),
      driverPhone: newVehicleForm.driverPhone.trim(),
      type: newVehicleForm.type,
      model: newVehicleForm.model.trim() || newVehicleForm.type,
      year: new Date().getFullYear(),
      maxWeightKg: newVehicleForm.maxWeightKg || 5000,
      maxVolumeCbm: 20,
      assignedBranchId: currentBranch.id,
      status: 'active',
      notes: 'تمت إضافتها مباشرة أثناء إعداد المانافيست',
    });

    // Populate current manifest fields
    setTruckPlate(createdVeh.plateNumber);
    setDriverName(createdVeh.driverName);
    setDriverPhone(createdVeh.driverPhone);
    setTruckType(createdVeh.type);
    setSelectedVehicleId(createdVeh.id);

    // Reset and close
    setShowNewVehicleModal(false);
    setNewVehicleError(null);
    setNewVehicleForm({
      plateNumber: '',
      driverName: '',
      driverPhone: '',
      type: 'شاحنة متوسطة (دينا)',
      model: '',
      maxWeightKg: 5000,
      ownership: 'company',
    });
    setPreviewSuccessNotice(`✓ تم تسجيل المركبة (${createdVeh.plateNumber}) وإدراج السائق (${createdVeh.driverName}) في المانافيست`);
    setTimeout(() => setPreviewSuccessNotice(null), 3500);
  };

  // Available currency counts for destination parcels
  const sypCount = destinationParcels.filter(
    (p) => (p.currency || 'SYP') === 'SYP' || p.codCurrency === 'SYP'
  ).length;
  const usdCount = destinationParcels.filter(
    (p) => p.currency === 'USD' || p.codCurrency === 'USD'
  ).length;

  // Available payment type counts
  const prepaidCount = destinationParcels.filter(
    (p) => getParcelPaymentSummary(p).normalizedType === 'prepaid'
  ).length;
  const collectCount = destinationParcels.filter(
    (p) => getParcelPaymentSummary(p).normalizedType === 'collect'
  ).length;
  const codCount = destinationParcels.filter(
    (p) => getParcelPaymentSummary(p).normalizedType === 'cod'
  ).length;

  // Filtered parcels based on search, payment, currency, and selection status
  const filteredParcels = destinationParcels.filter((p) => {
    // Search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTracking = p.trackingNumber.toLowerCase().includes(q);
      const matchReceipt = p.paperReceiptNumber?.toLowerCase().includes(q);
      const matchSender = p.sender.name.toLowerCase().includes(q) || p.sender.phone.includes(q);
      const matchReceiver =
        p.receiver.name.toLowerCase().includes(q) ||
        p.receiver.phone.includes(q) ||
        p.destinationAddress.toLowerCase().includes(q);
      const matchContent = p.contentDescription?.toLowerCase().includes(q);

      if (!matchTracking && !matchReceipt && !matchSender && !matchReceiver && !matchContent) {
        return false;
      }
    }

    // Payment Filter
    const summary = getParcelPaymentSummary(p);
    if (paymentFilter === 'cod' && summary.normalizedType !== 'cod') return false;
    if (paymentFilter === 'prepaid' && summary.normalizedType !== 'prepaid') return false;
    if (paymentFilter === 'collect' && summary.normalizedType !== 'collect') return false;

    // Currency Filter
    if (currencyFilter !== 'all') {
      const pCurr = p.currency || 'SYP';
      const pShipCurr = p.shippingCurrency || pCurr;
      const pCodCurr = p.codCurrency;
      if (pCurr !== currencyFilter && pShipCurr !== currencyFilter && pCodCurr !== currencyFilter) {
        return false;
      }
    }

    // Selection Filter
    const isSelected = selectedParcelIds.includes(p.id);
    if (selectionFilter === 'selected' && !isSelected) return false;
    if (selectionFilter === 'unselected' && isSelected) return false;

    return true;
  });

  // Selected parcel objects
  const selectedParcels = parcels.filter((p) => selectedParcelIds.includes(p.id));

  // Totals calculations
  const totalWeightKg = selectedParcels.reduce((acc, p) => acc + (p.weightKg || 0), 0);
  const totalPieces = selectedParcels.reduce((acc, p) => acc + (p.piecesCount || 1), 0);

  // Prepaid shipping totals (أجور الشحن المسددة سلفاً في فرع الانطلاق)
  const totalPrepaidFreightSyp = selectedParcels
    .filter((p) => {
      const s = getParcelPaymentSummary(p);
      return s.isShippingPrepaidBySender && s.shippingCurrency === 'SYP';
    })
    .reduce((acc, p) => acc + (p.shippingCost || 0), 0);

  // COD totals (تحصيل المبالغ المالية ضد الدفع - ثمن البضائع)
  const totalCodSyp = selectedParcels
    .filter((p) => {
      const s = getParcelPaymentSummary(p);
      return s.normalizedType === 'cod' && s.codCurrency === 'SYP';
    })
    .reduce((acc, p) => acc + (p.codAmount || 0), 0);
  const totalCodUsd = selectedParcels
    .filter((p) => {
      const s = getParcelPaymentSummary(p);
      return s.normalizedType === 'cod' && s.codCurrency === 'USD';
    })
    .reduce((acc, p) => acc + (p.codAmount || 0), 0);

  // Collect shipping totals
  const totalCollectShippingSyp = selectedParcels
    .filter((p) => {
      const s = getParcelPaymentSummary(p);
      return !s.isShippingPrepaidBySender && s.shippingCurrency === 'SYP';
    })
    .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
  const totalCollectShippingUsd = selectedParcels
    .filter((p) => {
      const s = getParcelPaymentSummary(p);
      return !s.isShippingPrepaidBySender && s.shippingCurrency === 'USD';
    })
    .reduce((acc, p) => acc + (p.shippingCost || 0), 0);

  // Total freight
  const totalFreightSyp = selectedParcels
    .filter((p) => (p.shippingCurrency || p.currency) === 'SYP')
    .reduce((acc, p) => acc + (p.shippingCost || 0), 0);
  const totalFreightUsd = selectedParcels
    .filter((p) => (p.shippingCurrency || p.currency) === 'USD')
    .reduce((acc, p) => acc + (p.shippingCost || 0), 0);

  // Total net cash required to collect at destination branch
  const totalDueAtDestSyp = totalCodSyp + totalCollectShippingSyp;
  const totalDueAtDestUsd = totalCodUsd + totalCollectShippingUsd;

  // Toggle single parcel
  const toggleParcel = (id: string) => {
    setSelectedParcelIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  // Select all currently visible / filtered parcels
  const selectAllFiltered = () => {
    const visibleIds = filteredParcels.map((p) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedParcelIds.includes(id));

    if (allSelected) {
      setSelectedParcelIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedParcelIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Handle barcode quick scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = barcodeInput.trim();
    if (!rawInput) return;

    const cleanCode = extractCleanTrackingQuery(rawInput).toUpperCase();
    const upperRaw = rawInput.toUpperCase();

    const foundParcel = destinationParcels.find(
      (p) =>
        p.trackingNumber.toUpperCase() === cleanCode ||
        p.trackingNumber.toUpperCase() === upperRaw ||
        (p.paperReceiptNumber && (
          p.paperReceiptNumber.toUpperCase() === cleanCode ||
          p.paperReceiptNumber.toUpperCase() === upperRaw
        )) ||
        p.id === cleanCode ||
        p.id === upperRaw
    );

    if (foundParcel) {
      if (!selectedParcelIds.includes(foundParcel.id)) {
        setSelectedParcelIds((prev) => [...prev, foundParcel.id]);
        setBarcodeNotification(`✅ تم إضافة الطرد: ${foundParcel.trackingNumber}`);
      } else {
        setBarcodeNotification(`⚠️ الطرد محدد بالفعل في المانافيست: ${foundParcel.trackingNumber}`);
      }
    } else {
      // Diagnostic check in all available parcels
      const anyParcel = availableParcels.find(
        (p) =>
          p.trackingNumber.toUpperCase() === cleanCode ||
          p.trackingNumber.toUpperCase() === upperRaw ||
          (p.paperReceiptNumber && (
            p.paperReceiptNumber.toUpperCase() === cleanCode ||
            p.paperReceiptNumber.toUpperCase() === upperRaw
          )) ||
          p.id === cleanCode ||
          p.id === upperRaw
      );

      if (anyParcel) {
        setBarcodeNotification(`⚠️ الطرد [${anyParcel.trackingNumber}] موجود ولكن وجهته إلى (${anyParcel.receiver.city || 'فرع آخر'}) وليست المحطة المحددة`);
      } else {
        setBarcodeNotification(`❌ لم يتم العثور على طرد بهذا الرمز في المستودع الموجه لهذه المحطة`);
      }
    }

    setBarcodeInput('');
    setTimeout(() => setBarcodeNotification(null), 3500);
  };

  // Preview manifest object for direct simulation & printing
  const previewManifest: TruckManifest = useMemo(() => {
    const fullNotes = [
      manifestNotes,
      securitySealNumber ? `رقم الرصاصة الأمنية: ${securitySealNumber}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      id: 'prv-mnf-' + Date.now(),
      manifestNumber: `MNF-${currentBranch.code || 'HUB'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-PRV`,
      originHubId: currentBranch.id,
      destinationHubId: destinationHubId || (destHubs[0]?.id ?? ''),
      truckPlate: truckPlate.trim() || 'دمشق - 821034',
      truckType: truckType.trim() || 'شاحنة مرسيدس 10 طن',
      driverName: driverName.trim() || 'السائق المعتمد',
      driverPhone: driverPhone.trim() || '09xxxxxxxx',
      parcelIds: selectedParcelIds,
      totalWeightKg,
      totalPieces,
      totalFreightSyp,
      totalFreightUsd,
      totalCodSyp,
      totalCodUsd,
      createdById: currentBranch.id || 'system',
      status: 'preparing',
      notes: fullNotes,
      createdAt: new Date().toISOString(),
      dispatchedAt: null,
      receivedAt: null,
    };
  }, [
    currentBranch,
    destinationHubId,
    destHubs,
    driverName,
    driverPhone,
    truckPlate,
    truckType,
    selectedParcelIds,
    totalWeightKg,
    totalPieces,
    totalFreightSyp,
    totalFreightUsd,
    totalCodSyp,
    totalCodUsd,
    manifestNotes,
    securitySealNumber,
  ]);

  // Final confirm & create with strict validation and conflict prevention
  const handleFinalSave = async () => {
    // 0. Strict central server check
    const isOnline = await ensureServerConnected();
    if (!isOnline) {
      // Keep modal and selections open and intact
      return;
    }

    if (!destinationHubId) {
      setValidationError('⚠️ يرجى تحديد المركز الوجهة للمانافيست');
      return;
    }
    if (!selectedParcelIds || selectedParcelIds.length === 0) {
      setValidationError('⚠️ يرجى اختيار طرد واحد على الأقل لتحميله بالمانافيست قبل الحفظ والاعتماد');
      return;
    }
    if (!driverName.trim()) {
      setValidationError('⚠️ يرجى إدخال اسم السائق المعتمد قبل الاعتماد والحفظ');
      return;
    }
    if (!truckPlate.trim()) {
      setValidationError('⚠️ يرجى إدخال رقم لوحة الشاحنة قبل الاعتماد والحفظ');
      return;
    }

    // Deduplicate parcel IDs
    const uniqueParcelIds = Array.from(new Set(selectedParcelIds));

    // Conflict checks
    const currentSelectedParcels = parcels.filter((p) => uniqueParcelIds.includes(p.id));
    const duplicateAssignedParcels = currentSelectedParcels.filter((p) => {
      if (!p.truckManifestId) return false;
      if (manifestToEdit && (p.truckManifestId === manifestToEdit.id || p.truckManifestId === manifestToEdit.manifestNumber)) return false;
      return truckManifests.some((m) => m.id === p.truckManifestId || m.manifestNumber === p.truckManifestId);
    });
    if (duplicateAssignedParcels.length > 0) {
      const trackings = duplicateAssignedParcels.map((p) => p.trackingNumber).join(', ');
      setValidationError(`⚠️ تعارض وتكرار: الطرود التالية مسجلة مسبقاً على مانافيست آخر: [${trackings}]`);
      return;
    }

    const invalidStatusParcels = currentSelectedParcels.filter(
      (p) => p.handlingStatus === 'delivered' || p.handlingStatus === 'delivered_uncollected' || p.handlingStatus === 'returned'
    );
    if (invalidStatusParcels.length > 0) {
      const trackings = invalidStatusParcels.map((p) => p.trackingNumber).join(', ');
      setValidationError(`⚠️ تعارض في الحالة: الطرود التالية بحالة تسليم أو مرتجعة ولا يمكن ترحيلها: [${trackings}]`);
      return;
    }

    const mismatchParcels = currentSelectedParcels.filter((p) => {
      if (p.destinationHubId === destinationHubId) return false;
      const tb = branches.find((b) => b.id === p.destinationHubId);
      return !(tb && tb.parentHubId === destinationHubId);
    });
    if (mismatchParcels.length > 0) {
      const trackings = mismatchParcels.map((p) => p.trackingNumber).join(', ');
      setValidationError(`⚠️ تعارض في الوجهة: الطرود [${trackings}] غير موجهة إلى مركز الوجهة المحدد.`);
      return;
    }

    setValidationError(null);
    const fullNotes = [
      manifestNotes,
      securitySealNumber ? `رقم الرصاصة الأمنية: ${securitySealNumber}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (manifestToEdit) {
      const updatedManifest = updateTruckManifest(manifestToEdit.id, {
        destinationHubId,
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        truckPlate: truckPlate.trim(),
        truckType: truckType.trim(),
        parcelIds: uniqueParcelIds,
        notes: fullNotes,
      });

      formDraftStorage.clearDraft(DRAFT_KEY);
      try {
        safeStorage.removeItem(DRAFT_KEY);
        safeStorage.removeItem(`orca_draft_${DRAFT_KEY}`);
        safeStorage.removeItem('orca_draft_create-manifest-modal');
        safeStorage.removeItem('ORCA_FORM_DRAFT_create-manifest-modal');
      } catch {
        // safe fallback
      }
      onClose();
      if (updatedManifest) {
        openPrintModal('manifest_a4', updatedManifest);
      }
    } else {
      const selectedParcelsList = parcels.filter((p) => uniqueParcelIds.includes(p.id));
      const effectiveOriginHubId =
        currentBranch?.id ||
        selectedParcelsList[0]?.originHubId ||
        branches.find((b) => b.type === 'main_hub')?.id ||
        branches[0]?.id ||
        '';

      const newManifest = createTruckManifest(
        effectiveOriginHubId,
        destinationHubId,
        driverName.trim(),
        driverPhone.trim(),
        truckPlate.trim(),
        truckType.trim(),
        uniqueParcelIds,
        fullNotes
      );

      // Clear local draft upon confirmed creation
      formDraftStorage.clearDraft(DRAFT_KEY);
      try {
        safeStorage.removeItem(DRAFT_KEY);
        safeStorage.removeItem(`orca_draft_${DRAFT_KEY}`);
        safeStorage.removeItem('orca_draft_create-manifest-modal');
        safeStorage.removeItem('ORCA_FORM_DRAFT_create-manifest-modal');
      } catch {
        // safe fallback
      }

      onClose();
      // Open official A4 print modal
      openPrintModal('manifest_a4', newManifest);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      id="fullscreen_manifest_creator_modal"
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col text-slate-100 select-none overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR: TITLE, ORIGIN & CLOSE                                  */}
      {/* ========================================================================= */}
      <header className="h-13 sm:h-14 px-3.5 sm:px-5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black text-white leading-tight">
              {manifestToEdit ? `تعديل المانافيست (${manifestToEdit.manifestNumber})` : 'إنشاء وتجهيز مانافيست ترحيل شاحنة'}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>مركز الانطلاق:</span>
              <span className="font-bold text-slate-200">
                {currentBranch.name} ({currentBranch.governorate})
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-mono text-[11px]">
                {availableParcels.length} طرد متوفر بالمستودع
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions: Close Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn_close_manifest_fullscreen"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 flex items-center gap-1.5 text-xs font-bold transition cursor-pointer border border-slate-700"
            title="إغلاق والعودة"
          >
            <X className="w-4 h-4" />
            <span>إغلاق</span>
          </button>
        </div>
      </header>

      {/* Draft Restoration Banner */}
      {draftPrompt && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              تم العثور على مسودة سابقة غير معتمدة لتجهيز مانافيست في هذا المركز. هل ترغب في استرجاعها؟
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
            >
              استرجاع المسودة
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              تجاهل وحذف
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="mx-3.5 mt-2.5 p-3 bg-rose-950/90 border border-rose-500/70 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2.5 font-bold shadow-lg animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-300 hover:text-white text-xs cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-rose-900/50"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success / Info Banner */}
      {previewSuccessNotice && (
        <div className="mx-3.5 mt-2.5 p-3 bg-emerald-950/90 border border-emerald-500/70 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2.5 font-bold shadow-lg animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{previewSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPreviewSuccessNotice(null)}
            className="text-emerald-300 hover:text-white text-xs cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-emerald-900/50"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP SETTINGS STRIP: DESTINATION, VEHICLE, DRIVER & FILTERS            */}
      {/* ========================================================================= */}
      <div className="p-2.5 sm:p-3 bg-slate-900/90 border-b border-slate-800 space-y-2 shrink-0">
        {/* ROW 1: DESTINATION & TRUCK CREDENTIALS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
          {/* Destination Hub Selection */}
          <div>
            <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>المركز الوجهة *</span>
              </span>
              <span className="text-xs text-amber-400/80 font-normal font-mono">
                {destinationParcels.length} طرد
              </span>
            </label>
            <select
              id="manifest_dest_hub_select"
              value={destinationHubId}
              onChange={(e) => {
                setDestinationHubId(e.target.value);
              }}
              className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none truncate"
            >
              {destHubs.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name} ({hub.governorate})
                </option>
              ))}
            </select>
          </div>

          {/* Fleet Vehicle Picker */}
          <div>
            <label className="block text-xs font-bold text-cyan-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                <span>مركبة الأسطول</span>
              </span>
              <span className="text-xs text-cyan-400/80 font-normal font-mono">
                {vehicles.length} متوفرة
              </span>
            </label>
            <div className="flex items-center gap-1">
              <select
                id="manifest_select_vehicle_directory"
                value={selectedVehicleId}
                onChange={(e) => handleSelectVehicleFromDirectory(e.target.value)}
                className="flex-1 min-w-0 bg-slate-950 border border-cyan-500/50 hover:border-cyan-400 focus:border-cyan-400 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none truncate"
                title="اختر مركبة من أسطول الشركة لملء بيانات السائق والشاحنة"
              >
                <option value="">-- اختر مركبة --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.driverName})
                  </option>
                ))}
              </select>
              <button
                type="button"
                id="btn_open_new_vehicle_modal"
                onClick={() => {
                  setNewVehicleError(null);
                  setShowNewVehicleModal(true);
                }}
                title="إضافة وتسجيل مركبة وسائق جديد في دليل الأسطول"
                className="p-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition cursor-pointer shrink-0 shadow-sm flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Driver Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>اسم السائق *</span>
            </label>
            <input
              type="text"
              id="manifest_driver_name_input"
              value={driverName}
              onChange={(e) => {
                setDriverName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="الاسم الثلاثي للسائق"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Driver Phone */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>هاتف السائق *</span>
            </label>
            <input
              type="tel"
              id="manifest_driver_phone_input"
              value={driverPhone}
              onKeyDown={blockNonPhoneKeys}
              onChange={(e) => setDriverPhone(sanitizePhone(e.target.value))}
              placeholder="09xxxxxxxx"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Truck Plate */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>رقم اللوحة *</span>
            </label>
            <input
              type="text"
              id="manifest_truck_plate_input"
              value={truckPlate}
              onChange={(e) => {
                setTruckPlate(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="مثال: دمشق - 821034"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Truck Type */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              نوع وسيلة النقل
            </label>
            <input
              type="text"
              value={truckType}
              onChange={(e) => setTruckType(e.target.value)}
              placeholder="مثال: دينا 5 طن"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Security Seal Number */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>الرصاصة الأمنية</span>
            </label>
            <input
              type="text"
              value={securitySealNumber}
              onChange={(e) => setSecuritySealNumber(e.target.value)}
              placeholder="رقم السيل (اختياري)"
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ROW 2: SEARCH, BARCODE SCANNER & ADVANCED FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              id="manifest_parcels_search_input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الباركود، المرسل، المستلم، العنوان، المحتويات..."
              className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-xl pr-9 pl-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Barcode Scanner Form */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex items-center gap-1.5 shrink-0 bg-slate-950 border border-slate-750 rounded-xl px-2 py-0.5"
          >
            <Barcode className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="مسح باركود الطرد..."
              className="w-36 bg-transparent text-xs text-white font-mono placeholder-slate-500 focus:outline-none py-1"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              إضافة
            </button>
          </form>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
            {/* Currency filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-xs text-slate-400 font-bold px-1.5 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                العملة:
              </span>
              <button
                type="button"
                onClick={() => setCurrencyFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  currencyFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                كافة العملات
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('SYP')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  currencyFilter === 'SYP'
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>ليرة سورية (SYP)</span>
                <span className="text-xs opacity-80 font-mono">({sypCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('USD')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  currencyFilter === 'USD'
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>دولار ($ USD)</span>
                <span className="text-xs opacity-80 font-mono">({usdCount})</span>
              </button>
            </div>

            {/* Payment filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  paymentFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>كل الدفعات</span>
                <span className="text-xs opacity-70 font-mono">({destinationParcels.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('prepaid')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  paymentFilter === 'prepaid'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>مدفوع سلفاً</span>
                <span className="text-xs opacity-80 font-mono">({prepaidCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('collect')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  paymentFilter === 'collect'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>على المستلم</span>
                <span className="text-xs opacity-80 font-mono">({collectCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('cod')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  paymentFilter === 'cod'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>تحصيل COD</span>
                <span className="text-xs opacity-80 font-mono">({codCount})</span>
              </button>
            </div>

            {/* Selection filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  selectionFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({destinationParcels.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectionFilter('selected')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  selectionFilter === 'selected'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                المحدد ({selectedParcelIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectionFilter('unselected')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  selectionFilter === 'unselected'
                    ? 'bg-slate-800 text-slate-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                غير المحدد ({destinationParcels.length - selectedParcelIds.length})
              </button>
            </div>
          </div>
        </div>

        {/* Notification alert for barcode scanner */}
        {barcodeNotification && (
          <div className="text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>{barcodeNotification}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. PARCELS TABLE CONTAINER (DESKTOP & MOBILE RESPONSIVE)                  */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto bg-slate-950/70 custom-scrollbar relative">
        {/* DESKTOP TABLE (>= 640px) */}
        <div className="hidden sm:block">
          <table className="w-full text-right text-xs border-collapse">
            {/* Table Sticky Header */}
            <thead className="bg-slate-900/95 sticky top-0 z-10 border-b border-slate-800 shadow-sm text-slate-300 font-bold">
              <tr>
                <th className="p-3 w-12 text-center">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-slate-300 hover:text-amber-400 transition cursor-pointer inline-flex items-center justify-center"
                    title="تحديد أو إلغاء تحديد كافة الطرود المعروضة"
                  >
                    {filteredParcels.length > 0 &&
                    filteredParcels.every((p) => selectedParcelIds.includes(p.id)) ? (
                      <CheckSquare className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 min-w-[200px]">رقم الشحنة (الباركود والوصل)</th>
                <th className="p-3 min-w-[220px]">المستلم والوجهة</th>
                <th className="p-3 w-44 text-center">حالة الدفع</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/80">
              {filteredParcels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                    <div className="font-bold text-slate-400 text-sm mb-1">
                      لا توجد طرود مطابقة للفلترة الحالية
                    </div>
                    <p className="text-xs text-slate-500">
                      {currencyFilter !== 'all'
                        ? `لا توجد طرود مطابقة لفلترة عملة ${currencyFilter === 'SYP' ? 'الليرة السورية (SYP)' : 'الدولار الأمريكي (USD)'}. يمكنك تغيير العملة أو إزالة شروط البحث.`
                        : 'تأكد من اختيار المركز الوجهة الصحيح أو إزالة شروط البحث والفلترة'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredParcels.map((parcel, idx) => {
                  const isSelected = selectedParcelIds.includes(parcel.id);
                  return (
                    <tr
                      key={parcel.id}
                      onClick={() => toggleParcel(parcel.id)}
                      className={`transition-colors cursor-pointer group select-none ${
                        isSelected
                          ? 'bg-amber-500/15 text-amber-100 hover:bg-amber-500/20'
                          : 'hover:bg-slate-900/80 text-slate-300'
                      }`}
                    >
                      {/* 1. Checkbox */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleParcel(parcel.id)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                        />
                      </td>

                      {/* 2. Sequence */}
                      <td className="p-3 text-center text-slate-500 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* 3. Tracking # & Receipt */}
                      <td className="p-3 font-mono font-bold text-cyan-300 text-xs min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Barcode className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span className="text-xs tracking-wider text-cyan-300 font-bold">{parcel.trackingNumber}</span>
                          </div>
                          {parcel.paperReceiptNumber && (
                            <span className="text-xs text-slate-300 font-sans font-normal bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-md shrink-0">
                              وصل: {parcel.paperReceiptNumber}
                            </span>
                          )}
                          {(parcel.isRecoveredFromPreviousShortage || parcel.shortageStatus === 'confirmed_at_origin' || parcel.previousShortageManifestNumber || parcel.lastManifestId || parcel.handlingStatus === 'leftover_origin_warehouse') && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
                              <span>↩️ متبقي من {parcel.previousShortageManifestNumber || parcel.lastManifestId || 'مانافيست سابق'}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Recipient & Destination */}
                      <td className="p-3">
                        <div className="font-bold text-slate-200 text-xs">{parcel.receiver.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[240px]">{parcel.destinationAddress || selectedDestHub?.governorate || 'وجهة الشحنة'}</span>
                          {selectedDestHub && (
                            <span className="text-xs font-semibold text-amber-400/90 mr-1">
                              • {selectedDestHub.name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Clean Payment Type Badge */}
                      <td className="p-3 text-center">
                        {(() => {
                          const summary = getParcelPaymentSummary(parcel);
                          if (summary.normalizedType === 'cod') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                                <span>💵 تحصيل COD</span>
                              </span>
                            );
                          }
                          if (summary.normalizedType === 'collect') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm">
                                <span>📋 على المستلم</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                              <span>✅ مدفوع سلفاً</span>
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW (< 640px) */}
        <div className="sm:hidden p-3 space-y-2">
          {filteredParcels.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <div className="font-bold text-slate-400 text-xs mb-1">
                لا توجد طرود مطابقة للفلترة الحالية
              </div>
            </div>
          ) : (
            filteredParcels.map((parcel) => {
              const isSelected = selectedParcelIds.includes(parcel.id);
              const summary = getParcelPaymentSummary(parcel);
              return (
                <div
                  key={parcel.id}
                  onClick={() => toggleParcel(parcel.id)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer select-none space-y-1.5 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleParcel(parcel.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      <span className="font-mono font-bold text-cyan-300 text-xs">
                        {parcel.trackingNumber}
                      </span>
                    </div>
                    {(parcel.isRecoveredFromPreviousShortage || parcel.shortageStatus === 'confirmed_at_origin' || parcel.previousShortageManifestNumber || parcel.lastManifestId || parcel.handlingStatus === 'leftover_origin_warehouse') && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ↩️ متبقي
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-200">
                    <span>{parcel.receiver.name}</span>
                    <span className="text-slate-500 mx-1">•</span>
                    <span className="text-slate-400">{parcel.destinationAddress || selectedDestHub?.governorate || 'وجهة الشحنة'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                    {summary.normalizedType === 'cod' ? (
                      <span className="text-amber-300 font-bold">💵 تحصيل COD</span>
                    ) : summary.normalizedType === 'collect' ? (
                      <span className="text-sky-300 font-bold">📋 على المستلم</span>
                    ) : (
                      <span className="text-emerald-300 font-bold">✅ مدفوع سلفاً</span>
                    )}
                    {parcel.weightKg > 0 && (
                      <span className="text-slate-400 font-mono text-[11px]">
                        {parcel.weightKg} كغ
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MANIFEST NOTES STRIP (COMPACT & CLEAN)                                 */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-3.5 py-2 flex items-center gap-3 text-xs shadow-inner shrink-0">
        <label className="font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          <span>ملاحظات المانافيست الرسمية (اختياري):</span>
        </label>
        <input
          type="text"
          value={manifestNotes}
          onChange={(e) => setManifestNotes(e.target.value)}
          placeholder="مثال: يرجى تسليم المانافيست لمسؤول المستودع فور الوصول، فحص سلامة الرصاصة الأمنية..."
          className="flex-1 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* ========================================================================= */}
      {/* 5. FOOTER SUMMARY & PRIMARY ACTIONS                                       */}
      {/* ========================================================================= */}
      <footer className="min-h-[4rem] py-2 px-4 sm:px-6 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between shrink-0 gap-3 shadow-2xl z-20">
        {/* Real-time Summary Counters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-amber-500/40 shadow-xs">
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-xs font-bold">المحدد:</span>
            <span className="font-mono font-black text-amber-300 text-sm">
              {selectedParcelIds.length} <span className="text-xs font-normal text-slate-400">بوليصة (من {destinationParcels.length})</span>
            </span>
            <span className="text-slate-600 mx-1">•</span>
            <span className="text-cyan-300 font-mono font-bold text-xs flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              <span>{totalPieces} طرد</span>
            </span>
            <span className="text-slate-600 mx-1">•</span>
            <span className="text-emerald-300 font-mono font-bold text-xs flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatQuantity(totalWeightKg, 'weight')} كغ ({(totalWeightKg / 1000).toFixed(2)} طن)</span>
            </span>
          </div>

          {driverName && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span>السائق:</span>
              <strong className="text-slate-200 font-bold">{driverName}</strong>
              {truckPlate && <span className="font-mono text-amber-300">({truckPlate})</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Print Preview Button */}
          <button
            type="button"
            onClick={() => openPrintModal('manifest_a4', previewManifest)}
            className="h-9 px-3.5 bg-slate-800 hover:bg-slate-750 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 hover:border-emerald-500/40 shadow-sm active:scale-95"
            title="معاينة نموذج طباعة المانافيست A4"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">خيارات الطباعة والمعاينة</span>
            <span className="sm:hidden">معاينة</span>
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-200 text-xs font-bold transition cursor-pointer border border-slate-700"
          >
            إلغاء
          </button>

          {/* Primary Save & Approve Button */}
          <button
            type="button"
            id="btn_confirm_and_save_manifest"
            onClick={handleFinalSave}
            className="h-9 px-4 sm:px-5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-95 border border-emerald-400/40"
            title="تأكيد واعتماد وحفظ المانافيست نهائياً وطباعته"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-100" />
            <span>حفظ واعتماد المانافيست ◄</span>
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 6. NEW VEHICLE & DRIVER REGISTRATION MODAL                                */}
      {/* ========================================================================= */}
      {showNewVehicleModal && (
        <div
          id="modal_register_new_vehicle"
          className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 font-['Cairo',sans-serif]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    تسجيل مركبة وسائق جديد في دليل الأسطول
                  </h3>
                  <p className="text-xs text-slate-400">
                    سيتم حفظ المركبة بدليل أسطول الشركة وإدراج بياناتها مباشرة في هذا المانافيست
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewVehicleModal(false);
                  setNewVehicleError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {newVehicleError && (
              <div className="text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 px-3 py-2 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{newVehicleError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Plate Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    رقم لوحة المركبة / الشاحنة <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newVehicleForm.plateNumber}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, plateNumber: e.target.value }))
                    }
                    placeholder="مثال: دمشق - 984521"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    نوع وسيلة النقل <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newVehicleForm.type}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, type: e.target.value as VehicleType }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="شاحنة متوسطة (دينا)">شاحنة متوسطة (دينا)</option>
                    <option value="شاحنة قاطرة ومقطورة">شاحنة قاطرة ومقطورة (تريلا)</option>
                    <option value="شاحنة مغلقة (سكس)">شاحنة مغلقة (سكس 10-15 طن)</option>
                    <option value="فان بضائع مقفل">فان بضائع مقفل (H1 / Hiace)</option>
                    <option value="بيك أب توزيع">بيك أب توزيع (1-2 طن)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Driver Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    اسم السائق المعتمد <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newVehicleForm.driverName}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, driverName: e.target.value }))
                    }
                    placeholder="الاسم الثلاثي للسائق"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Driver Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    رقم هاتف السائق <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newVehicleForm.driverPhone}
                    onKeyDown={blockNonPhoneKeys}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, driverPhone: sanitizePhone(e.target.value) }))
                    }
                    placeholder="09xxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Model */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    طراز / صانع المركبة
                  </label>
                  <input
                    type="text"
                    value={newVehicleForm.model}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, model: e.target.value }))
                    }
                    placeholder="مثال: Mercedes Actros"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                {/* Max Weight */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    الحمولة القصوى (كغ)
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={newVehicleForm.maxWeightKg}
                    onChange={(e) =>
                      setNewVehicleForm((prev) => ({ ...prev, maxWeightKg: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVehicleModal(false);
                    setNewVehicleError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ وتسجيل بالأسطول وإدراج بالمانافيست</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
