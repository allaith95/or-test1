import React, { useState, useEffect, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Warehouse,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PhoneCall,
  Bell,
  Package,
  Search,
  ArrowDownLeft,
  Calendar,
  Check,
  ShieldAlert,
  ClipboardCheck,
  Archive,
  Scale,
  Sparkles,
  RotateCcw,
  Coins,
  Send,
  Building2,
  Volume2,
  ArrowRightLeft,
  Wallet,
  Bike,
  FileText,
  Printer,
  ScanLine,
  X,
  ShieldCheck,
  Lock,
  Boxes,
  PackageCheck,
} from 'lucide-react';
import { Parcel, TruckManifest, CourierManifest, User, PRE_DELIVERY_RETURN_REASONS } from '../types';
import { ManifestVerificationModal } from './ManifestVerificationModal';
import { CourierCustodySettlementModal } from './CourierCustodySettlementModal';
import { DeliveryHandoverModal } from './DeliveryHandoverModal';
import { ReturnedParcelsAnalyticsModal } from './ReturnedParcelsAnalyticsModal';
import { getParcelPaymentSummary } from '../utils/settlementMath';

export const WarehouseArrivalsView: React.FC = () => {
  const {
    currentBranch,
    currentUser,
    branches,
    parcels,
    truckManifests,
    courierManifests,
    users,
    deliverParcel,
    settleCourierManifest,
    markTruckArrived,
    receiveTruckManifest,
    notifyReceiver,
    setActiveModule,
    openPrintModal,
    formatCurrency,
    openShortageResolutionModal,
    openLostParcelSettlementModal,
    openRerouteModal,
    reDispatchLeftoverParcel,
    playShortageAlertSound,
    playTruckDockArrivalSound,
    ensureServerConnected,
    receiveReturnedParcelAtBranch,
    reDispatchReturnedParcel,
    stageParcelForReturnToOrigin,
    receiveReverseShipmentAtOrigin,
    handoverReturnedParcelToSender,
    initiatePreDeliveryReturn,
    cancelPreDeliveryReturn,
  } = useOrca();

  const [isReturnAnalyticsModalOpen, setIsReturnAnalyticsModalOpen] = useState(false);
  const [preReturnModalParcel, setPreReturnModalParcel] = useState<Parcel | null>(null);
  const [preReturnReason, setPreReturnReason] = useState<string>(PRE_DELIVERY_RETURN_REASONS[0]);
  const [preReturnNotes, setPreReturnNotes] = useState<string>('');
  const [handoverModalParcel, setHandoverModalParcel] = useState<Parcel | null>(null);
  const [handoverPaymentOption, setHandoverPaymentOption] = useState<'paid' | 'refused'>('paid');

  const [activeTab, setActiveTab] = useState<
    | 'incoming_trucks'
    | 'in_warehouse'
    | 'returned_pending'
    | 'pre_delivery_returns'
    | 'reverse_incoming'
    | 'reverse_ready_sender'
    | 'outbound_manifest_staging'
    | 'courier_manifests'
    | 'leftover_warehouse'
    | 'lost_parcels'
    | 'overdue'
    | 'notified'
  >('incoming_trucks');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedManifestForVerify, setSelectedManifestForVerify] = useState<TruckManifest | null>(null);
  const [settlingCourierManifest, setSettlingCourierManifest] = useState<CourierManifest | null>(null);
  const [settlementSuccessNotice, setSettlementSuccessNotice] = useState<string | null>(null);
  const [selectedParcelForDelivery, setSelectedParcelForDelivery] = useState<Parcel | null>(null);
  const [deliverySuccessMessage, setDeliverySuccessMessage] = useState<string | null>(null);
  const [deliveryErrorMessage, setDeliveryErrorMessage] = useState<string | null>(null);

  // Tick for countdown timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // 0. Outbound parcels stored in origin warehouse waiting for manifest preparation
  const knownTruckManifestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of truckManifests) {
      if (m.id) ids.add(m.id);
      if (m.manifestNumber) ids.add(m.manifestNumber);
    }
    return ids;
  }, [truckManifests]);

  const outboundManifestReadyParcels = useMemo(() => {
    return parcels.filter((p) => {
      // 0. الشحنات العكسية الجاهزة للشحن العائد في هذا الفرع
      const isReverseAtBranch =
        p.isReverseShipment &&
        (p.handlingStatus === 'returning_to_origin' || p.handlingStatus === 'return_initiated') &&
        (isSuperAdmin || !currentBranch?.id || p.currentLocationBranchId === currentBranch.id || p.destinationHubId === currentBranch.id);

      if (isReverseAtBranch) {
        return !p.truckManifestId || !knownTruckManifestIds.has(p.truckManifestId);
      }

      // 1. الشحنات الصادرة العادية
      const matchesOrigin =
        isSuperAdmin ||
        !currentBranch?.id ||
        p.originHubId === currentBranch.id ||
        p.originCollectionBranchId === currentBranch.id ||
        p.originBranchId === currentBranch.id ||
        (currentBranch.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id === p.originCollectionBranchId || b.id === p.originBranchId) &&
              b.parentHubId === currentBranch.id
          ));

      if (!matchesOrigin) return false;

      const isStatusReady =
        (p.handlingStatus === 'received_at_hub' ||
         p.handlingStatus === 'received_at_origin_hub' ||
         p.handlingStatus === 'leftover_origin_warehouse') &&
        !p.isReverseShipment;

      if (!isStatusReady) return false;

      return !p.truckManifestId || !knownTruckManifestIds.has(p.truckManifestId);
    });
  }, [parcels, isSuperAdmin, currentBranch, branches, knownTruckManifestIds]);

  // 1. Incoming trucks heading to current branch dock or all trucks for super admin / supervision
  const incomingTrucks = useMemo(() => {
    return truckManifests.filter((m) => {
      const destId = (m.destinationHubId || '').trim().toLowerCase();
      const currId = (currentBranch?.id || '').trim().toLowerCase();
      const currCode = (currentBranch?.code || '').trim().toLowerCase();
      const currName = (currentBranch?.name || '').trim().toLowerCase();

      const isTargetDest =
        isSuperAdmin ||
        !currentBranch?.id ||
        currentBranch?.id === 'all_branches_supervision' ||
        destId === currId ||
        destId === currCode ||
        destId === currName ||
        branches.some(
          (b) =>
            (b.id?.toLowerCase() === currId || b.code?.toLowerCase() === currCode) &&
            (b.parentHubId?.toLowerCase() === destId || b.id?.toLowerCase() === destId)
        ) ||
        (currentBranch?.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id?.toLowerCase() === destId || b.code?.toLowerCase() === destId) &&
              b.parentHubId?.toLowerCase() === currId
          ));

      if (!isTargetDest) return false;
      return m.status === 'dispatched' || m.status === 'arrived_unloading';
    });
  }, [truckManifests, currentBranch, branches, isSuperAdmin]);

  // 2. Standard received parcels stored in destination warehouse
  const warehouseParcels = parcels.filter(
    (p) =>
      (isSuperAdmin || !currentBranch?.id || p.destinationHubId === currentBranch?.id) &&
      p.handlingStatus === 'received_at_dest'
  );

  // 3. Leftover / Missing from previous shipments warehouse (at origin hub)
  const leftoverParcels = parcels.filter(
    (p) =>
      p.handlingStatus === 'leftover_origin_warehouse' &&
      (isSuperAdmin || !currentBranch?.id || p.originHubId === currentBranch?.id || p.currentLocationBranchId === currentBranch?.id)
  );

  // 4. Lost parcels & settlements warehouse
  const lostParcels = parcels.filter(
    (p) =>
      (p.handlingStatus === 'lost_in_transit' || p.handlingStatus === 'settled_loss_compensated') &&
      (isSuperAdmin || p.originHubId === currentBranch?.id || p.destinationHubId === currentBranch?.id)
  );

  // 5. Urgent Shortages waiting for Origin Verification
  const pendingOriginVerifications = parcels.filter(
    (p) =>
      p.shortageStatus === 'pending_origin_verification' &&
      (isSuperAdmin || p.originHubId === currentBranch?.id)
  );

  // 5b. Returned parcels from couriers awaiting branch warehouse intake or routing
  const returnedPendingParcels = parcels.filter(
    (p) =>
      (isSuperAdmin || !currentBranch?.id || p.currentLocationBranchId === currentBranch?.id || p.destinationHubId === currentBranch?.id) &&
      (p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch')
  );

  // 5c. Reverse shipments in transit / arriving at origin branch
  const reverseIncomingParcels = parcels.filter(
    (p) =>
      p.handlingStatus === 'returning_to_origin' &&
      (isSuperAdmin || !currentBranch?.id || p.originHubId === currentBranch.id)
  );

  // 5d. Returned parcels arrived at origin branch awaiting merchant/sender collection
  const reverseReadySenderParcels = parcels.filter(
    (p) =>
      p.handlingStatus === 'returned_to_origin' &&
      (isSuperAdmin || !currentBranch?.id || p.originHubId === currentBranch.id)
  );

  // 5e. Pre-delivery return parcels marked at current branch
  const preDeliveryReturnParcels = parcels.filter(
    (p) =>
      p.handlingStatus === 'return_initiated' &&
      (isSuperAdmin || !currentBranch?.id || p.currentLocationBranchId === currentBranch.id)
  );

  // 6. Courier Manifests for Warehouse Settlement
  const branchCourierManifests = courierManifests.filter(
    (m) => (isSuperAdmin || m.hubId === currentBranch?.id)
  );
  const activeCourierManifests = branchCourierManifests.filter(
    (m) => m.status === 'active' || m.status === 'courier_credit'
  );

  // Calculate dwell time in days and hours
  const getDwellTimeInfo = (parcel: Parcel) => {
    if (!parcel.arrivedAtDestAt) return { days: 0, hours: 0, isOverdue: false };
    const diffMs = currentTime - new Date(parcel.arrivedAtDestAt).getTime();
    const days = Math.floor(diffMs / (1000 * 3600 * 24));
    const hours = Math.floor((diffMs % (1000 * 3600 * 24)) / (1000 * 3600));
    const isOverdue = days >= (parcel.storageGraceDays || 3);
    return { days, hours, isOverdue };
  };

  // Notification Response Timer calculation (from moment notifiedAt was pressed)
  const getNotificationTimerInfo = (parcel: Parcel) => {
    if (!parcel.notifiedAt) return null;
    const notifiedTimestamp = new Date(parcel.notifiedAt).getTime();
    const limitMs = (parcel.notificationDueHours || 24) * 3600 * 1000;
    const elapsedMs = currentTime - notifiedTimestamp;
    const remainingMs = limitMs - elapsedMs;

    if (remainingMs <= 0) {
      const overdueHours = Math.floor(Math.abs(remainingMs) / (1000 * 3600));
      return {
        expired: true,
        text: `تجاوز مهلة الحضور بـ ${overdueHours} ساعة!`,
        remainingHours: 0,
        remainingMins: 0,
        remainingSecs: 0,
      };
    }

    const hours = Math.floor(remainingMs / (1000 * 3600));
    const mins = Math.floor((remainingMs % (1000 * 3600)) / (1000 * 60));
    const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return {
      expired: false,
      text: `${hours}س : ${mins}د : ${secs}ث متبقية`,
      remainingHours: hours,
      remainingMins: mins,
      remainingSecs: secs,
    };
  };

  // Overdue parcels
  const overdueParcels = warehouseParcels.filter((p) => getDwellTimeInfo(p).isOverdue);

  // Parcels that have been notified
  const notifiedParcels = warehouseParcels.filter((p) => !!p.notifiedAt);

  // Filtered parcels based on search and tab
  const getDisplayParcels = () => {
    let list: Parcel[] = [];
    if (activeTab === 'in_warehouse') list = warehouseParcels;
    else if (activeTab === 'returned_pending') list = returnedPendingParcels;
    else if (activeTab === 'pre_delivery_returns') list = preDeliveryReturnParcels;
    else if (activeTab === 'reverse_incoming') list = reverseIncomingParcels;
    else if (activeTab === 'reverse_ready_sender') list = reverseReadySenderParcels;
    else if (activeTab === 'outbound_manifest_staging') list = outboundManifestReadyParcels;
    else if (activeTab === 'leftover_warehouse') list = leftoverParcels;
    else if (activeTab === 'lost_parcels') list = lostParcels;
    else if (activeTab === 'overdue') list = overdueParcels;
    else if (activeTab === 'notified') list = notifiedParcels;

    if (!searchTerm) return list;
    return list.filter(
      (p) =>
        p.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.receiver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.receiver.phone.includes(searchTerm) ||
        p.sender.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contentDescription.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const displayParcels = getDisplayParcels();

  return (
    <div className="space-y-4 pb-20 text-slate-100">
      {/* Top Header Card - Compact */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-mono font-bold">
              قسم الوارد • رصيف الاستلام والتفريغ
            </span>
            <h1 className="text-sm sm:text-base font-black text-white">
              رصيف الاستلام والمطابقة وتفريغ الشاحنات
            </h1>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            فرع الوصول: {currentBranch.name}
          </span>
        </div>
      </div>

      {/* Urgent Shortage Banner for Origin Hub */}
      {pendingOriginVerifications.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-slate-900 border-2 border-amber-500/80 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">تنبيه تأكيد نقص عاجل وارد من فرع الوجهة!</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-bounce">
                  {pendingOriginVerifications.length} طرد معلق
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5">
                أبلغت فروع الوجهة عن وجود نقص عند تفريغ الشاحنات. يرجى تأكيد وجود الطرود في مستودعكم أو فقدانها على الطريق.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={playShortageAlertSound}
              title="تشغيل صوت التنبيه"
              className="px-3 py-2 bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>صوت التنبيه</span>
            </button>
            <button
              type="button"
              onClick={() => openShortageResolutionModal(pendingOriginVerifications.map((p) => p.id))}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shrink-0"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>فتح واجهة تأكيد النقص والمطابقة ◄</span>
            </button>
          </div>
        </div>
      )}

      {/* Delivery Success Notice */}
      {deliverySuccessMessage && (
        <div className="bg-emerald-950/90 border-2 border-emerald-500 text-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs sm:text-sm">{deliverySuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeliverySuccessMessage(null)}
            className="p-1 hover:bg-emerald-900/60 rounded-lg text-emerald-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delivery Error Notice */}
      {deliveryErrorMessage && (
        <div className="bg-rose-950/90 border-2 border-rose-500 text-rose-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-bold text-xs sm:text-sm">{deliveryErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeliveryErrorMessage(null)}
            className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Incoming Trucks Alert Banner at Destination Dock */}
      {incomingTrucks.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-cyan-950/80 border border-amber-500/50 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              <Truck className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  رصيف الوصول: توجد ({incomingTrucks.length}) شاحنة شحن متجهة إلى هذا المركز
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  تزامن فوري نشط
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تظهر الشاحنات فور ترحيلها من فرع الانطلاق، ويمكن تفريغها ومطابقتها مباشرة فور وقوفها برصيف الاستلام.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={playTruckDockArrivalSound}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="تجربة رنين نغمة وصول الشاحنة للرصيف"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>نغمة الرصيف</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('incoming_trucks')}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            >
              عرض الشاحنات القادمة ◄
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('incoming_trucks')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'incoming_trucks'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>شاحنات واردة بالطريق ({incomingTrucks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('in_warehouse')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'in_warehouse'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          <span>بضائع بمستودع الاستلام ({warehouseParcels.length})</span>
        </button>

        {/* Returned Parcels Awaiting Intake from Couriers */}
        <button
          onClick={() => setActiveTab('returned_pending')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'returned_pending'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>مرتجعات الموزعين ({returnedPendingParcels.length})</span>
        </button>

        {/* Pre-Delivery Return Parcels Marked Before Dispatch */}
        <button
          onClick={() => setActiveTab('pre_delivery_returns')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'pre_delivery_returns'
              ? 'bg-rose-700 text-white shadow-md'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>مرتجعات قبل التسليم ({preDeliveryReturnParcels.length})</span>
        </button>

        {/* Reverse Shipments In Transit to Origin Hub */}
        <button
          onClick={() => setActiveTab('reverse_incoming')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'reverse_incoming'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-purple-400 hover:text-purple-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>شحنات عكسية قادمة للأصل ({reverseIncomingParcels.length})</span>
        </button>

        {/* Returned Parcels Ready for Sender Collection at Origin */}
        <button
          onClick={() => setActiveTab('reverse_ready_sender')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'reverse_ready_sender'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'text-emerald-400 hover:text-emerald-300'
          }`}
        >
          <PackageCheck className="w-3.5 h-3.5" />
          <span>بانتظار استلام المرسل ({reverseReadySenderParcels.length})</span>
        </button>

        {/* Outbound Manifest Preparation Staging Tab */}
        <button
          onClick={() => setActiveTab('outbound_manifest_staging')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'outbound_manifest_staging'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5 text-amber-300" />
          <span>مستودع الصادر وتجهيز المانافيست ({outboundManifestReadyParcels.length})</span>
        </button>

        {/* Courier Manifests Settlement Tab */}
        <button
          onClick={() => setActiveTab('courier_manifests')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'courier_manifests'
              ? 'bg-amber-500 text-black shadow-md font-black'
              : 'text-amber-400 hover:text-amber-300'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          <span>ترصيد مانافيستات الموزعين ({activeCourierManifests.length})</span>
        </button>

        {/* Leftover / Missing from previous shipments warehouse */}
        <button
          onClick={() => setActiveTab('leftover_warehouse')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'leftover_warehouse'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-amber-400 hover:text-amber-300'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>مستودع الطرود الناقصة من شحنات سابقة ({leftoverParcels.length})</span>
        </button>

        {/* Lost parcels warehouse */}
        <button
          onClick={() => setActiveTab('lost_parcels')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'lost_parcels'
              ? 'bg-rose-700 text-white shadow-md'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>مستودع الطرود المفقودة والتسويات ({lostParcels.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>تجاوزت سماح التخزين ({overdueParcels.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notified')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'notified'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-cyan-400 hover:text-cyan-300'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>المؤقتات النشطة للتبليغ ({notifiedParcels.length})</span>
        </button>
      </div>

      {/* VIEW 1: INCOMING TRUCKS READY FOR RECEIPT */}
      {activeTab === 'incoming_trucks' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" />
            <span>الشاحنات المتوجهة إلى مستودع المركز ({incomingTrucks.length})</span>
          </h2>

          {incomingTrucks.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-xs">
              لا توجد شاحنات في الطريق حالياً متوجهة لهذا المركز
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingTrucks.map((truck) => {
                const orig = branches.find((b) => b.id === truck.originHubId);

                return (
                  <div
                    key={truck.id}
                    className="bg-slate-900/90 border border-amber-500/50 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                        <div>
                          <span className="font-mono font-black text-amber-300 text-sm">
                            {truck.manifestNumber}
                          </span>
                          <p className="text-xs text-slate-300 font-bold mt-0.5">
                            {truck.truckPlate} • {truck.driverName}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            truck.status === 'arrived_unloading'
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-400 animate-pulse'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                          }`}
                        >
                          {truck.status === 'arrived_unloading' ? 'وصلت وتتحضر للتفريغ' : 'في الطريق إليكم'}
                        </span>
                      </div>

                      <div className="my-3 space-y-1.5 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">انطلقت من:</span>
                          <span className="font-bold text-white">{orig?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">إجمالي الطرود:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            {truck.parcelIds.length} شحنة ({truck.totalWeightKg} كغ)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">وقت الترحيل:</span>
                          <span className="font-mono text-slate-300 font-semibold" dir="ltr">
                            {truck.dispatchedAt
                              ? new Date(truck.dispatchedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })
                              : 'Recent'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Stage 1 & Stage 2 Options */}
                    <div className="border-t border-slate-800 pt-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openPrintModal('manifest_a4', truck)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-xl"
                        >
                          معاينة
                        </button>

                        {/* Stage 1 Option */}
                        {truck.status === 'dispatched' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await ensureServerConnected();
                              if (ok) {
                                markTruckArrived(truck.id);
                                setSelectedManifestForVerify(truck);
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[11px] font-bold shadow-md shadow-amber-600/30 flex items-center gap-1 transition-all cursor-pointer"
                            title="المرحلة 1: تسجيل وصول الشاحنة وفتح نافذة التفريغ والمطابقة مباشرة"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>1️⃣ وصلت — ابدأ التفريغ</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedManifestForVerify(truck)}
                            className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-amber-200 rounded-xl text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 transition-all cursor-pointer"
                            title="الشاحنة برصيف التفريغ — فتح نافذة التفريغ والمطابقة"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>✓ وصلت — متابعة التفريغ</span>
                          </button>
                        )}
                      </div>

                      {/* Stage 2 Options: Either Quick Receive All or Detailed Inspection Modal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await ensureServerConnected();
                            if (ok) {
                              receiveTruckManifest(truck.id);
                              setActiveTab('in_warehouse');
                            }
                          }}
                          className="py-2 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-md shadow-emerald-700/30 flex items-center justify-center gap-1 transition-all transform active:scale-95 cursor-pointer"
                          title="استقبال المانافيست وتفريغ كافة الشحنات مباشرة إلى مستودع الاستلام"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>⚡ استقبال فوري للوارد</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedManifestForVerify(truck)}
                          className="py-2 px-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-xl text-[11px] font-black shadow-md shadow-cyan-600/20 flex items-center justify-center gap-1 transition-all transform active:scale-95 cursor-pointer"
                          title="مطابقة الطرود طرداً بطرد وتوثيق أي نقص قبل الإدخال"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>2️⃣ مطابقة وتأكيد التفريغ ◄</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: LEFTOVER WAREHOUSE (مستودع الطرود الناقصة من شحنات سابقة) */}
      {activeTab === 'leftover_warehouse' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                <span>مستودع الطرود الناقصة من شحنات سابقة ({displayParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                طرود تم تأكيد بقائها في مستودع الصادر بعد الإبلاغ عن نقصها في الشاحنات السابقة، وجاهزة للإدراج بالرحلات القادمة
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالرقم أو المستلم..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع والنوع</th>
                  <th className="py-2.5 px-3 font-semibold">الوجهة المقصودة</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل والمستلم</th>
                  <th className="py-2.5 px-3 font-semibold">تاريخ التوثيق والملاحظة</th>
                  <th className="py-2.5 px-3 font-semibold">القيمة المالية</th>
                  <th className="py-2.5 px-3 font-semibold text-center">إجراء إعادة التوجيه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      لا توجد طرود ناقصة متبقية في مستودع الصادر حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => {
                    const dest = branches.find((b) => b.id === parcel.destinationHubId);
                    return (
                      <tr key={parcel.id} className="hover:bg-amber-950/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-amber-300 font-mono">{parcel.trackingNumber}</div>
                          <div className="text-[10px] text-slate-400">{parcel.packageType} • {parcel.weightKg} كغ</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{dest?.name || 'الوجهة'}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                              ✓ تم الحل
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 rounded inline-block">
                              متبقي من مانافيست [{parcel.previousShortageManifestNumber || parcel.shortageManifestNumber || parcel.lastManifestId || 'TM-001'}]
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200">إلى: {parcel.receiver.name} ({parcel.receiver.phone})</div>
                          <div className="text-[10px] text-slate-400">من: {parcel.sender.name}</div>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <div className="text-[11px] text-amber-200">
                            {parcel.shortageResolutionNotes || 'متبقي بمستودع الصادر'}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono" dir="ltr">
                            {parcel.shortageResolvedAt ? new Date(parcel.shortageResolvedAt).toLocaleString('ar-SY') : ''}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                          {getParcelPaymentSummary(parcel).summaryDueText}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              reDispatchLeftoverParcel(parcel.id);
                              setActiveModule('manifests');
                            }}
                            className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto active:scale-95 cursor-pointer shadow-sm shadow-emerald-950"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-400" />
                            <span>+ إضافة لمانافيست جديد</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: LOST PARCELS & SETTLEMENTS (مستودع الطرود المفقودة والتسويات) */}
      {activeTab === 'lost_parcels' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-rose-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-rose-400" />
                <span>مستودع الطرود المفقودة والتسويات المالية ({displayParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                سجل الطرود المفقودة على الطريق وإجراءات التسوية وصرف التعويضات واسترداد الأمانات
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالتتبع أو المستلم أو التعويض..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع والمواصفات</th>
                  <th className="py-2.5 px-3 font-semibold">المسار (من - إلى)</th>
                  <th className="py-2.5 px-3 font-semibold">أطراف الشحنة</th>
                  <th className="py-2.5 px-3 font-semibold">حالة التسوية والتعويض</th>
                  <th className="py-2.5 px-3 font-semibold">تفاصيل ومحضر التسوية</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      لا توجد طرود مفقودة مسجلة حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => {
                    const orig = branches.find((b) => b.id === parcel.originHubId);
                    const dest = branches.find((b) => b.id === parcel.destinationHubId);
                    const isSettled = parcel.handlingStatus === 'settled_loss_compensated';

                    return (
                      <tr key={parcel.id} className="hover:bg-rose-950/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-rose-400 font-mono">{parcel.trackingNumber}</div>
                          <div className="text-[10px] text-slate-400">{parcel.packageType} • {parcel.contentDescription}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-white font-medium">{orig?.name} ◄ {dest?.name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">مانافيست: {parcel.shortageManifestNumber || 'غير محدد'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200">المرسل: {parcel.sender.name}</div>
                          <div className="text-slate-400 text-[10px]">المستلم: {parcel.receiver.name} ({parcel.receiver.phone})</div>
                        </td>
                        <td className="py-3 px-3">
                          {isSettled ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>تمت التسوية والتعويض</span>
                              </span>
                              {parcel.lossCompensationDetails?.voucherNumber && (
                                <div className="text-[10px] font-mono text-cyan-300">
                                  سند صرف: {parcel.lossCompensationDetails.voucherNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 w-fit animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>بانتظار التسوية والتعويض</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-xs text-[11px]">
                          {parcel.lossCompensationDetails ? (
                            <div className="text-slate-300 space-y-0.5">
                              <div>المستفيد: <strong>{parcel.lossCompensationDetails.beneficiaryName}</strong></div>
                              {parcel.lossCompensationDetails.compensationAmount > 0 && (
                                <div className="font-mono text-emerald-400 font-bold">
                                  تعويض: {formatCurrency(parcel.lossCompensationDetails.compensationAmount, parcel.lossCompensationDetails.currency)}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500">{parcel.lossCompensationDetails.notes}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">
                              {parcel.shortageResolutionNotes || 'فقد على الطريق أثناء النقل'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isSuperAdmin ? (
                            <button
                              type="button"
                              onClick={() => openLostParcelSettlementModal(parcel)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto active:scale-95 cursor-pointer ${
                                isSettled
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                  : 'bg-rose-600/30 hover:bg-rose-600/60 text-rose-200 border border-rose-500/40 shadow-sm'
                              }`}
                            >
                              <Coins className="w-3.5 h-3.5 text-rose-300" />
                              <span>{isSettled ? 'تعديل / استعادة ◄' : 'إجراء تسوية / استعادة ◄'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openLostParcelSettlementModal(parcel)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 mx-auto cursor-pointer"
                              title="تسوية الطرود المفقودة صلاحية حصرية لمدير التطبيق"
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>{isSettled ? 'تمت التسوية' : 'بانتظار الإدارة'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 1.5: OUTBOUND MANIFEST PREPARATION STAGING WAREHOUSE */}
      {activeTab === 'outbound_manifest_staging' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-400" />
                <span>مستودع الصادر والتحضير للشحن بالمانافيست ({displayParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                كافة الطرود المسجلة ميدانياً بواسطة الموزعين أو من الاستقبال المركزي، مودعة في مستودع الصادر وجاهزة لإدراجها في مانافيست الشاحنة.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالرقم، المستلم، أو المدخل..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveModule('manifests')}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>فتح واجهة المانافيست والشاحنات ◄</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10.5px]">
                  <th className="py-2.5 px-3 font-semibold">رقم البوليصة والنوع</th>
                  <th className="py-2.5 px-3 font-semibold">مركز الانطلاق</th>
                  <th className="py-2.5 px-3 font-semibold">الوجهة المقصودة</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل والمستلم</th>
                  <th className="py-2.5 px-3 font-semibold">الوزن والأبعاد</th>
                  <th className="py-2.5 px-3 font-semibold">أجور الشحن والمطلوب</th>
                  <th className="py-2.5 px-3 font-semibold">مدخل البيانات (الموزع / الموظف)</th>
                  <th className="py-2.5 px-3 font-semibold text-center">حالة المستودع والإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 font-sans text-xs">
                      لا توجد طرود حالياً بانتظار تجهيز المانافيست في مستودع الصادر.
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => {
                    const orig = branches.find((b) => b.id === parcel.originHubId);
                    const dest = branches.find((b) => b.id === parcel.destinationHubId);
                    return (
                      <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-amber-300" dir="ltr">{parcel.trackingNumber}</div>
                          <div className="text-[10px] text-slate-400 font-sans">{parcel.packageType} • {parcel.shippingCategory === 'postal' ? 'بريدي' : 'بضائع'}</div>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-slate-200">{orig?.name || orig?.governorate || 'الانطلاق'}</span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-amber-300">📍 {dest?.name || dest?.governorate || 'الوجهة'}</span>
                          <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{parcel.destinationAddress}</span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <div className="text-slate-200 font-bold">إلى: {parcel.receiver.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{parcel.receiver.phone}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">من: {parcel.sender.name}</div>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-300">
                          {parcel.weightKg} كغ • {parcel.piecesCount} قطعة
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-emerald-400 block">
                            {parcel.paymentType === 'cod' ? `${parcel.totalDue} ${parcel.currency} (COD)` : `${parcel.shippingCost} ${parcel.currency}`}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {parcel.paymentType === 'prepaid' ? 'مدفوع سلفاً' : parcel.paymentType === 'collect' ? 'على المستلم' : 'ضد الدفع'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10.5px] font-bold">
                            {parcel.registeredByUserName || parcel.createdByName || 'موظف النظام'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => setActiveModule('manifests')}
                            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-[10.5px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                          >
                            <span>جاهز للشحن</span>
                            <span>📦</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: RETURNED PARCELS AWAITING INTAKE FROM COURIERS */}
      {activeTab === 'returned_pending' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>إدارة الطرود المرتجعة بالمستودع ({returnedPendingParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                فحص واستلام المرتجعات من الموزعين، وإعادة جدولتها للتوزيع المحلي أو إرجاعها لفرع الأصل
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsReturnAnalyticsModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>📊</span>
                <span>تقارير وإحصائيات المرتجعات</span>
              </button>

              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالتتبع أو الموزع أو المستلم..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                  <th className="py-2.5 px-3 font-semibold">الموزع المُعيد</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم وهاتفه</th>
                  <th className="py-2.5 px-3 font-semibold">سبب وملاحظات الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">توقيت الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ المطلوب</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500 text-xs">
                      لا توجد طرود مرتجعة معلقة بانتظار الاستلام حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => (
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
                        {parcel.handlingStatus === 'returned' ? (
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
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                reDispatchReturnedParcel(parcel.id, 'إعادة تسليم محلي');
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 shadow transition cursor-pointer"
                              title="إعادة الطرد للمخزون لجدولته مع موزع آخر"
                            >
                              <span>🔄</span>
                              <span>إعادة للتوزيع</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                stageParcelForReturnToOrigin(parcel.id);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 shadow transition cursor-pointer"
                              title="إدراج في المانافيست العكسي لشحنه لفرع الأصل"
                            >
                              <span>🚛</span>
                              <span>إرجاع للأصل</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: PRE-DELIVERY RETURN PARCELS */}
      {activeTab === 'pre_delivery_returns' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>مرتجعات معلنة قبل التسليم ({preDeliveryReturnParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                الطرود التي أُلغيت أو تقرر إرجاعها قبل خروج الموزع، جاهزة للتحميل بشاحنة العودة للأصل أو الإلغاء
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالتتبع أو المستلم أو السبب..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم والوجهة</th>
                  <th className="py-2.5 px-3 font-semibold">فرع الأصل والمرسل</th>
                  <th className="py-2.5 px-3 font-semibold">سبب الإرجاع وملاحظاته</th>
                  <th className="py-2.5 px-3 font-semibold">أجور الشحن العكسي</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                      لا توجد طرود معلنة للإرجاع قبل التسليم حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                        {parcel.trackingNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-200">{parcel.receiver.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.receiver.phone}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-purple-300">{parcel.sender.name}</div>
                        <div className="text-[10px] text-slate-400">فرع الأصل: {parcel.originHubId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          {parcel.returnInitiatedReason || 'إلغاء قبل التسليم'}
                        </span>
                        {parcel.returnInitiatedNotes && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{parcel.returnInitiatedNotes}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                        {formatCurrency(parcel.returnShippingCost || 0, parcel.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => cancelPreDeliveryReturn(parcel.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer"
                            title="إلغاء الإرجاع وإعادة الطرد للمخزون العادي"
                          >
                            إلغاء الإرجاع
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('outbound_manifest_staging')}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition cursor-pointer"
                            title="الانتقال لتجهيز المانافيست الصادر للشاحنة"
                          >
                            تجهيز بالمانافيست 🚛
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: REVERSE SHIPMENTS IN TRANSIT / ARRIVING AT ORIGIN BRANCH */}
      {activeTab === 'reverse_incoming' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                <span>شحنات عكسية قادمة من فروع أخرى ({reverseIncomingParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                الطرود المرتجعة المشحونة من الفروع الأخرى إلى هذا المركز كفرع انطلاق أصلي لاستلامها وتجهيزها للمرسل
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالتتبع أو المرسل أو المستلم..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل الأصلي</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم وجهة الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">سبب الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">أجور الشحن العكسي</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                      لا توجد شحنات عكسية قادمة لهذا المركز حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                        {parcel.trackingNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-purple-300">{parcel.sender.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.sender.phone}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-200">{parcel.receiver.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{parcel.destinationHubId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          {parcel.returnReason || 'رفض استلام'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                        {formatCurrency(parcel.returnShippingCost || 0, parcel.currency)}
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {parcel.returnShippingPaidBy === 'sender' ? 'على المرسل' : 'على الشركة'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            receiveReverseShipmentAtOrigin(parcel.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow mx-auto transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>استلام في فرع الأصل</span>
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

      {/* VIEW: REVERSE SHIPMENTS ARRIVED AT ORIGIN READY FOR SENDER PICKUP */}
      {activeTab === 'reverse_ready_sender' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                <span>طرود مرتجعة بانتظار استلام أصحابها (المرسلين) ({reverseReadySenderParcels.length})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                وصلت واستقرت بمستودع فرع الأصل. اضغط تسليم عند حضور التاجر/المرسل لاستلام بضاعته
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالمرسل أو الهاتف أو التتبع..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل صاحب البضاعة</th>
                  <th className="py-2.5 px-3 font-semibold">سبب الإرجاع</th>
                  <th className="py-2.5 px-3 font-semibold">أجور الشحن العكسي</th>
                  <th className="py-2.5 px-3 font-semibold">تاريخ الوصول للأصل</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                      لا توجد طرود مرتجعة بانتظار تسليمها للمرسلين حالياً
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => (
                    <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                        {parcel.trackingNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-emerald-300">{parcel.sender.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.sender.phone}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                          {parcel.returnReason || 'مرتجع'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                        {formatCurrency(parcel.returnShippingCost || 0, parcel.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        <div>{parcel.receivedBackAt ? new Date(parcel.receivedBackAt).toLocaleDateString('ar-SY') : 'اليوم'}</div>
                        {parcel.returnPickupDeadline && (
                          <div className="mt-0.5">
                            {new Date(parcel.returnPickupDeadline).getTime() < Date.now() ? (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                ⚠️ متأخر عن الاستلام
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                مهلة: {new Date(parcel.returnPickupDeadline).toLocaleDateString('ar-SY')}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if ((parcel.returnShippingCost || 0) > 0 && parcel.returnShippingPaidBy === 'sender') {
                              setHandoverModalParcel(parcel);
                              setHandoverPaymentOption('paid');
                            } else {
                              handoverReturnedParcelToSender(parcel.id, 'تسليم يدوي للمرسل بالفرع');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow mx-auto transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تسليم للمرسل ✓</span>
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

      {/* VIEW 2, 3, 4: STANDARD WAREHOUSE PARCELS & AGING TIMERS */}
      {activeTab !== 'incoming_trucks' && activeTab !== 'returned_pending' && activeTab !== 'reverse_incoming' && activeTab !== 'reverse_ready_sender' && activeTab !== 'leftover_warehouse' && activeTab !== 'lost_parcels' && activeTab !== 'courier_manifests' && activeTab !== 'outbound_manifest_staging' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-violet-400" />
                <span>
                  {activeTab === 'overdue'
                    ? `بضائع تجاوزت فترة السماح (${displayParcels.length})`
                    : activeTab === 'notified'
                    ? `متابعة مؤقتات البضائع المُبلّغ عنها (${displayParcels.length})`
                    : `مخزون مستودع الاستلام الحالي (${displayParcels.length})`}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                متابعة دقيقة لزمن الركود والاتصال بالمستلمين لتسريع وتيرة التسليم
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالمستلم أو الهاتف أو التتبع..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم التتبع والنوع</th>
                  <th className="py-2.5 px-3 font-semibold">المستلم وهاتفه</th>
                  <th className="py-2.5 px-3 font-semibold">المرسل والمصدر</th>
                  <th className="py-2.5 px-3 font-semibold">مدة البقاء بالمستودع</th>
                  <th className="py-2.5 px-3 font-semibold">حالة الإبلاغ والمؤقت</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ المطلوب</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayParcels.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد بضائع في المستودع ضمن هذا التصنيف
                    </td>
                  </tr>
                ) : (
                  displayParcels.map((parcel) => {
                    const dwell = getDwellTimeInfo(parcel);
                    const notifTimer = getNotificationTimerInfo(parcel);

                    return (
                      <tr
                        key={parcel.id}
                        className={`transition-colors ${
                          dwell.isOverdue
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-cyan-300 font-mono">
                            {parcel.trackingNumber}
                          </div>
                          <div className="text-[10px] text-slate-400">{parcel.packageType}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {parcel.weightKg} كغ • {parcel.piecesCount} قطعة
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200">{parcel.receiver.name}</div>
                          <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                            <PhoneCall className="w-3 h-3" />
                            <span>{parcel.receiver.phone}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="text-slate-300">{parcel.sender.name}</div>
                          <div className="text-[10px] text-slate-500">{parcel.sender.city}</div>
                        </td>

                        {/* Dwell Time Badge */}
                        <td className="py-3 px-3">
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                              dwell.isOverdue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                : dwell.days >= 2
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {dwell.days} يوم و {dwell.hours} ساعة
                            </span>
                          </div>
                          {dwell.isOverdue && (
                            <div className="text-[9px] text-rose-400 font-bold mt-0.5">
                              ⚠️ تجاوز مهلة السماح (3 أيام)
                            </div>
                          )}
                        </td>

                        {/* Notification Status & Countdown Timer */}
                        <td className="py-3 px-3">
                          {parcel.notifiedAt && notifTimer ? (
                            <div className="space-y-0.5">
                              <div
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit ${
                                  notifTimer.expired
                                    ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-bounce'
                                    : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{notifTimer.text}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono" dir="ltr">
                                Notified:{' '}
                                {new Date(parcel.notifiedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => notifyReceiver(parcel.id)}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Bell className="w-3 h-3" />
                              <span>تم إبلاغ المستلم (بدء المؤقت)</span>
                            </button>
                          )}
                        </td>

                        {/* Total Due */}
                        <td className="py-3 px-3 font-mono">
                          {(() => {
                            const s = getParcelPaymentSummary(parcel);
                            if (s.normalizedType === 'cod' && !s.isSameCurrency) {
                              return (
                                <div className="space-y-0.5">
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
                              <div className="font-bold text-emerald-400">
                                {s.summaryDueText}
                              </div>
                            );
                          })()}
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            {parcel.paymentType === 'cod' ? 'COD + شحن' : parcel.paymentType === 'prepaid' ? 'مدفوع سلفاً' : 'على المستلم'}
                          </span>
                        </td>

                        {/* Direct Delivery Shortcut & Reroute Button */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openRerouteModal(parcel)}
                              title="إعادة توجيه الطرد لوجهة ومستلم جديد"
                              className="px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                              <span>إعادة توجيه 🔁</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPreReturnModalParcel(parcel);
                                setPreReturnReason(PRE_DELIVERY_RETURN_REASONS[0]);
                                setPreReturnNotes('');
                              }}
                              title="إعلان إرجاع الطرد قبل التسليم"
                              className="px-2 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                              <span>↩️ إرجاع</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedParcelForDelivery(parcel)}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 shadow-sm shadow-emerald-600/30 flex items-center gap-1"
                              title="تسليم الطرد مباشرة على الهوية السورية وقبض المستحقات"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              <span>تسليم على الهوية ◄</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2.5: COURIER MANIFESTS & WAREHOUSE SETTLEMENT */}
      {activeTab === 'courier_manifests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/80 border border-neutral-800 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>ترصيد وإقفال مانافيستات الموزعين (قسم الوارد حصراً)</span>
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                    {branchCourierManifests.length} مانافيست
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  تدقيق تسليمات الموزعين، استلام الطرود المرتجعة إلى المستودع، وقبض المبالغ المحصلة وإقفال الذمم دون الحاجة لأمين الصندوق.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModule('delivery')}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>إسناد وتوليد مانافيست جديد ◄</span>
            </button>
          </div>

          {settlementSuccessNotice && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl flex items-start justify-between gap-3 text-emerald-200 text-xs shadow-lg animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-black text-white text-sm">تم اعتماد ترصيد المانافيست بنجاح لدى قسم الوارد!</div>
                  <p className="text-emerald-300 leading-relaxed">{settlementSuccessNotice}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettlementSuccessNotice(null)}
                className="text-emerald-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Manifests List */}
          {branchCourierManifests.length === 0 ? (
            <div className="p-12 text-center bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
              <Bike className="w-12 h-12 text-neutral-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-300">لا توجد مانافيستات توزيع مسندة لفرعك حالياً</h3>
                <p className="text-xs text-neutral-500">يمكنك إنشاء مانافيست توزيع وإسناد الطرود لموزع معتمد من واجهة التوزيع والتسليم.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {branchCourierManifests.map((manifest) => {
                const courier = users.find((u) => u.id === manifest.courierId);
                const isSettled = manifest.status === 'settled';
                const isCredit = manifest.status === 'courier_credit';
                const isActive = manifest.status === 'active';

                const totalParcels = manifest.parcelIds.length;
                const deliveredCount = manifest.deliveredParcelIds?.length || 0;
                const uncollectedCount = manifest.uncollectedParcelIds?.length || 0;
                const returnedCount = manifest.returnedParcelIds?.length || 0;
                const pendingCount = Math.max(0, totalParcels - deliveredCount - uncollectedCount - returnedCount);

                return (
                  <div
                    key={manifest.id}
                    className={`rounded-2xl border p-4 space-y-3 transition-all ${
                      isSettled
                        ? 'bg-neutral-950/60 border-neutral-800/80 opacity-80'
                        : isCredit
                        ? 'bg-neutral-950 border-rose-500/40 shadow-lg'
                        : 'bg-neutral-950 border-amber-500/40 shadow-lg'
                    }`}
                  >
                    {/* Header: Manifest info & Courier */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-black border border-neutral-800 flex items-center justify-center font-mono font-black text-amber-400 text-xs">
                          {manifest.manifestNumber.slice(-4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-sm">
                              {manifest.manifestNumber}
                            </span>
                            {isSettled && (
                              <span className="bg-neutral-800 text-neutral-300 border border-neutral-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                مرصد ومغلق بالكامل
                              </span>
                            )}
                            {isCredit && (
                              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md text-[10px] font-bold animate-pulse">
                                معلق بالذمة للترصيد النهائي
                              </span>
                            )}
                            {isActive && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                قيد التوزيع الميداني
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                            <span>الموزع: <strong className="text-neutral-200">{courier?.name || 'موزع غير محدد'}</strong></span>
                            {courier?.phone && <span className="font-mono">({courier.phone})</span>}
                            <span>•</span>
                            <span>تاريخ الإسناد: {new Date(manifest.assignedAt).toLocaleDateString('ar-SY')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {!isSettled ? (
                          <button
                            type="button"
                            onClick={() => setSettlingCourierManifest(manifest)}
                            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>تدقيق وترصيد العهدة مع الموزع ◄</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSettlingCourierManifest(manifest)}
                            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>عرض تفاصيل التصفية</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats & Financial Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="bg-black p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 block">إجمالي الطرود:</span>
                        <div className="font-mono font-bold text-white text-sm mt-0.5">
                          {totalParcels} طرد
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          مسلّم: {deliveredCount} | معلق: {uncollectedCount} | مرتجع: {returnedCount}
                        </div>
                      </div>

                      <div className="bg-black p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 block">المبالغ المقبوضة (ل.س):</span>
                        <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                          {formatCurrency(manifest.settlementSummary?.totalCollectedSyp || 0, 'SYP')}
                        </div>
                        {manifest.settlementSummary?.totalCollectedUsd && manifest.settlementSummary.totalCollectedUsd > 0 ? (
                          <div className="text-[10px] text-emerald-400 font-mono">
                            + {formatCurrency(manifest.settlementSummary.totalCollectedUsd, 'USD')}
                          </div>
                        ) : null}
                      </div>

                      <div className="bg-black p-2.5 rounded-xl border border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 block">المبالغ غير المقبوضة (ذمة):</span>
                        <div className={`font-mono font-bold text-sm mt-0.5 ${(manifest.settlementSummary?.totalUncollectedSyp || 0) > 0 ? 'text-rose-400' : 'text-neutral-400'}`}>
                          {formatCurrency(manifest.settlementSummary?.totalUncollectedSyp || 0, 'SYP')}
                        </div>
                      </div>

                      <div className="bg-black p-2.5 rounded-xl border border-amber-500/30">
                        <span className="text-[10px] text-amber-300 block font-bold">صافي المودع بالوارد:</span>
                        <div className="font-mono font-black text-amber-400 text-sm mt-0.5">
                          {formatCurrency(manifest.settlementSummary?.netDepositedSyp || 0, 'SYP')}
                        </div>
                      </div>
                    </div>

                    {manifest.notes && (
                      <div className="bg-black/60 p-2 rounded-lg border border-neutral-900 text-[11px] text-neutral-400">
                        <strong className="text-neutral-300">ملاحظات: </strong>
                        <span>{manifest.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manifest Verification & Discharge Modal */}
      {selectedManifestForVerify && (
        <ManifestVerificationModal
          isOpen={!!selectedManifestForVerify}
          manifest={selectedManifestForVerify}
          onClose={() => setSelectedManifestForVerify(null)}
          onDischarged={() => setActiveTab('in_warehouse')}
        />
      )}

      {/* Courier Manifest Inbound Settlement Modal */}
      {settlingCourierManifest && (
        <CourierCustodySettlementModal
          manifest={settlingCourierManifest}
          courier={users.find((u) => u.id === settlingCourierManifest.courierId)}
          currentBranch={currentBranch}
          parcels={parcels}
          onClose={() => setSettlingCourierManifest(null)}
          onConfirmSettlement={(settlementData) => {
            settleCourierManifest(
              settlingCourierManifest.id,
              settlementData.deliveredIds,
              settlementData.returnedIds,
              {
                collectedSyp: settlementData.collectedSyp,
                collectedUsd: settlementData.collectedUsd,
                courierCommissionSyp: settlementData.courierCommissionSyp || 0,
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
            setSettlementSuccessNotice(
              isCredit
                ? `تم ترصيد مانافيست الموزع كـ (مستند معلق ذمة)! تم استلام المقبوضات (${formatCurrency(settlementData.netDepositedSyp, 'SYP')})، وتوثيق ذمة معلقة (${formatCurrency(settlementData.uncollectedSyp || 0, 'SYP')})، واسترجاع (${settlementData.returnedIds.length}) طرد إلى مستودع الوارد بنجاح.`
                : `تم ترصيد وإقفال المانافيست نهائياً مع قسم الوارد! تم اعتماد (${settlementData.deliveredIds.length}) طرد مسلّم، واستلام (${settlementData.returnedIds.length}) طرد مرتجع بالمستودع، وإيداع صافي المقبوضات (${formatCurrency(settlementData.netDepositedSyp, 'SYP')}) بصندوق الوارد.`
            );
            setSettlingCourierManifest(null);
          }}
        />
      )}

      {/* Direct Delivery on National ID Modal */}
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
              setDeliveryErrorMessage(res.error || 'تعذر تسليم الطرد');
              setDeliverySuccessMessage(null);
              setSelectedParcelForDelivery(null);
              return;
            }

            setDeliveryErrorMessage(null);
            setDeliverySuccessMessage(
              `تم تسليم الشحنة (${selectedParcelForDelivery.trackingNumber}) بنجاح للمستلم [${
                deliveryData.actualReceiverName || selectedParcelForDelivery.receiver.name
              }] وقراءة وتوثيق الهوية وإيداع المقبوضات بصندوق الفرع!`
            );
            setSelectedParcelForDelivery(null);
          }}
        />
      )}

      {/* Pre-Delivery Return Initiation Modal */}
      {preReturnModalParcel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-300">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>إعلان إرجاع الطرد قبل التسليم</span>
              </h3>
              <button
                onClick={() => setPreReturnModalParcel(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div><span className="text-slate-400">رقم التتبع:</span> <span className="font-mono font-bold text-cyan-300">{preReturnModalParcel.trackingNumber}</span></div>
              <div><span className="text-slate-400">المستلم:</span> <span className="font-bold text-slate-200">{preReturnModalParcel.receiver.name}</span></div>
              <div><span className="text-slate-400">المرسل:</span> <span className="text-slate-300">{preReturnModalParcel.sender.name} ({preReturnModalParcel.originHubId})</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">سبب الإرجاع قبل التسليم:</label>
              <select
                value={preReturnReason}
                onChange={(e) => setPreReturnReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {PRE_DELIVERY_RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">ملاحظات إضافية:</label>
              <textarea
                value={preReturnNotes}
                onChange={(e) => setPreReturnNotes(e.target.value)}
                placeholder="تفاصيل سبب الإلغاء أو اتصال العميل..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPreReturnModalParcel(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  initiatePreDeliveryReturn(preReturnModalParcel.id, preReturnReason, preReturnNotes);
                  setPreReturnModalParcel(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تأكيد الإرجاع للأصل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Handover with Payment Confirmation Modal */}
      {handoverModalParcel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>تسليم الطرد المرتجع للمرسل الأصلي</span>
              </h3>
              <button
                onClick={() => setHandoverModalParcel(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div><span className="text-slate-400">رقم التتبع:</span> <span className="font-mono font-bold text-cyan-300">{handoverModalParcel.trackingNumber}</span></div>
              <div><span className="text-slate-400">المرسل المستلم:</span> <span className="font-bold text-slate-200">{handoverModalParcel.sender.name}</span></div>
              <div><span className="text-slate-400">أجور الشحن العكسي المستحقة:</span> <span className="font-bold text-amber-400 font-mono">{formatCurrency(handoverModalParcel.returnShippingCost || 0, handoverModalParcel.currency)}</span></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">حالة تحصيل أجور الشحن العكسي:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHandoverPaymentOption('paid')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    handoverPaymentOption === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>💵</span>
                  <span>سدد نقداً بالصندوق</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHandoverPaymentOption('refused')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    handoverPaymentOption === 'refused'
                      ? 'bg-rose-700 text-white border-rose-500 shadow-md shadow-rose-700/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>⚠️</span>
                  <span>رفض الدفع (قيد ذمة)</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setHandoverModalParcel(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  handoverReturnedParcelToSender(handoverModalParcel.id, undefined, {
                    paymentStatus: handoverPaymentOption,
                  });
                  setHandoverModalParcel(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تأكيد التسليم للمرسل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal for Returned Parcels */}
      <ReturnedParcelsAnalyticsModal
        isOpen={isReturnAnalyticsModalOpen}
        onClose={() => setIsReturnAnalyticsModalOpen(false)}
      />
    </div>
  );
};
