import React, { useState, useEffect, useMemo } from 'react';
import { TruckManifest, Parcel } from '../types';
import { useOrca } from '../context/OrcaContext';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  X,
  PackageCheck,
  PackageX,
  Search,
  Check,
  ShieldAlert,
  FileSpreadsheet,
  ClipboardCheck,
} from 'lucide-react';

interface ManifestVerificationModalProps {
  manifest: TruckManifest | null;
  isOpen: boolean;
  onClose: () => void;
  onDischarged?: () => void;
}

export const ManifestVerificationModal: React.FC<ManifestVerificationModalProps> = ({
  manifest,
  isOpen,
  onClose,
  onDischarged,
}) => {
  const { parcels, branches, completeTruckDischarge, formatCurrency, ensureServerConnected } = useOrca();

  // All manifest parcels matching by id, trackingNumber, or manifest link
  const manifestParcels = useMemo(() => {
    if (!manifest) return [];
    return parcels.filter(
      (p) =>
        (manifest.parcelIds || []).includes(p.id) ||
        (manifest.parcelIds || []).includes(p.trackingNumber) ||
        p.truckManifestId === manifest.id ||
        p.truckManifestId === manifest.manifestNumber
    );
  }, [parcels, manifest]);

  // All hooks MUST be declared at the top level unconditionally (Rules of Hooks)
  const [parcelStatus, setParcelStatus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (manifest?.parcelIds || []).forEach((id) => {
      initial[id] = true; // Default all to present
    });
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset parcel status whenever the modal opens or manifest changes
  useEffect(() => {
    if (isOpen && manifest) {
      const initial: Record<string, boolean> = {};
      manifestParcels.forEach((p) => {
        initial[p.id] = true; // Default all to present
      });
      (manifest.parcelIds || []).forEach((id) => {
        if (initial[id] === undefined) initial[id] = true;
      });
      setParcelStatus(initial);
      setSearchQuery('');
      setDischargeNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen, manifest, manifestParcels]);

  if (!isOpen || !manifest) return null;

  const originBranch = branches.find((b) => b.id === manifest.originHubId);
  const destBranch = branches.find((b) => b.id === manifest.destinationHubId);

  const toggleParcelStatus = (parcelId: string) => {
    setParcelStatus((prev) => ({
      ...prev,
      [parcelId]: prev[parcelId] === false ? true : false,
    }));
  };

  const markAllAsPresent = () => {
    const updated: Record<string, boolean> = {};
    manifestParcels.forEach((p) => {
      updated[p.id] = true;
    });
    setParcelStatus(updated);
  };

  const markAllAsMissing = () => {
    const updated: Record<string, boolean> = {};
    manifestParcels.forEach((p) => {
      updated[p.id] = false;
    });
    setParcelStatus(updated);
  };

  // Safe computation: All manifest parcels are verified unless explicitly unchecked (= false)
  const verifiedParcelIds = manifestParcels.filter((p) => parcelStatus[p.id] !== false).map((p) => p.id);
  const missingParcelIds = manifestParcels.filter((p) => parcelStatus[p.id] === false).map((p) => p.id);

  const filteredParcels = manifestParcels.filter(
    (p) =>
      p.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.receiver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contentDescription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitDischarge = async () => {
    const isOnline = await ensureServerConnected();
    if (!isOnline) {
      // Keep modal open and checklist intact
      return;
    }
    setIsSubmitting(true);
    completeTruckDischarge(manifest.id, verifiedParcelIds, missingParcelIds, dischargeNotes);
    setIsSubmitting(false);
    onClose();
    if (onDischarged) {
      onDischarged();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col w-full h-[100dvh] max-h-screen bg-slate-950/95 backdrop-blur-sm text-slate-100 p-0 sm:p-2 md:p-3 overflow-hidden animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-full max-h-[100dvh] sm:max-h-[calc(100dvh-1rem)] bg-slate-950 sm:rounded-2xl border sm:border-slate-800 shadow-2xl overflow-hidden">
        {/* Fullscreen Header */}
        <div className="bg-slate-900/95 px-4 sm:px-8 py-3 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-300">
                  مطابقة وتفريغ الحمولة
                </span>
                <span className="text-xs font-mono bg-slate-800 text-cyan-300 px-2.5 py-0.5 rounded-lg border border-slate-700 font-bold tracking-wider">
                  {manifest.manifestNumber}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-bold">
                  واجهة كاملة الشاشة
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-0.5">
                مطابقة المانافيست مع الطرود الواصلة وتأكيد تفريغ الشاحنة
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Primary Confirm Button in Header - Always visible regardless of taskbar/scrolling */}
            <button
              type="button"
              id="btn_header_confirm_manifest_receipt"
              onClick={handleSubmitDischarge}
              disabled={isSubmitting}
              className="px-3.5 sm:px-5 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer border border-emerald-400/50"
              title="تأكيد تفريغ الحمولة واستلام المانافيست وإدخال الشحنات للمستودع"
            >
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-100" />
              <span>تأكيد استلام المانافيست وتفريغ الحمولة ◄</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="إغلاق والعودة"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">إغلاق</span>
            </button>
          </div>
        </div>

        {/* Truck & Route Info Summary */}
        <div className="px-4 sm:px-8 py-3 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shrink-0">
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
            <span className="text-[10px] text-slate-500 block">مركب الانطلاق والوصول:</span>
            <span className="font-bold text-white text-xs sm:text-sm">
              {originBranch?.name} ◄ {destBranch?.name}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
            <span className="text-[10px] text-slate-500 block">الشاحنة والسائق:</span>
            <span className="font-bold text-amber-300 text-xs sm:text-sm">
              {manifest.truckPlate} ({manifest.driverName})
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
            <span className="text-[10px] text-slate-500 block">إجمالي الطرود بالمانافيست:</span>
            <span className="font-mono font-bold text-cyan-300 text-xs sm:text-sm">
              {manifestParcels.length} شحنة ({manifest.totalWeightKg} كغ)
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 shadow-sm">
            <span className="text-[10px] text-slate-500 block">نتيجة المطابقة والتدقيق:</span>
            <div className="flex items-center gap-2 font-bold font-mono text-xs sm:text-sm">
              <span className="text-emerald-400">{verifiedParcelIds.length} مطابق</span>
              {missingParcelIds.length > 0 && (
                <span className="text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/50">
                  ({missingParcelIds.length} نقص)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Bulk Actions */}
        <div className="px-4 sm:px-8 py-3 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="مسح باركود أو البحث برقم التتبع/المستلم..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={markAllAsPresent}
              className="px-3.5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>تحديد كافة الطرود كـ مطابقة وموجودة ({manifestParcels.length})</span>
            </button>
            <button
              type="button"
              onClick={markAllAsMissing}
              className="px-3.5 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <PackageX className="w-4 h-4" />
              <span>تحديد الكل كـ نقص</span>
            </button>
          </div>
        </div>

        {/* Parcels Inspection Table */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-2.5">
          <div className="text-xs text-slate-400 font-bold mb-2 flex items-center justify-between">
            <span className="text-slate-200">
              قائمة الطرود الواردة بالمانافيست للمطابقة ({filteredParcels.length} من أصل {manifestParcels.length}):
            </span>
            <span className="text-xs text-amber-400">
              💡 اضغط على زر (نقص / غير موجود) بجانب أي طرد مفقود
            </span>
          </div>

          {filteredParcels.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-slate-800">
              لا توجد طرود تطابق خيار البحث
            </div>
          ) : (
            <div className="space-y-2">
              {filteredParcels.map((parcel) => {
                const isPresent = parcelStatus[parcel.id] ?? true;

                return (
                  <div
                    key={parcel.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isPresent
                        ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/40'
                        : 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-cyan-300 text-xs">
                          {parcel.trackingNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {parcel.packageType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {parcel.piecesCount} قطع | {parcel.weightKg} كغ
                        </span>
                      </div>
                      <div className="text-xs text-white font-semibold">
                        المستلم: {parcel.receiver.name} ({parcel.receiver.phone}) — {parcel.destinationAddress}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        محتوى الشحنة: {parcel.contentDescription || 'غير محدد'}
                      </div>
                    </div>

                    {/* Toggle Button for parcel availability */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPresent ? (
                        <button
                          type="button"
                          onClick={() => toggleParcelStatus(parcel.id)}
                          className="px-3 py-2 bg-emerald-600/30 hover:bg-rose-600/40 text-emerald-300 hover:text-rose-200 border border-emerald-500/50 hover:border-rose-500/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>مطابق وموجود (اضغط للتغيير كـ نقص)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleParcelStatus(parcel.id)}
                          className="px-3 py-2 bg-rose-600 text-white border border-rose-400 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-rose-600/30 animate-pulse cursor-pointer"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-300" />
                          <span>🚨 طرد غير موجود (محدد كـ نقص)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Notes & Submit - Raised and padded safely above Windows taskbar and system frames */}
        <div className="px-4 sm:px-8 pt-3 pb-8 sm:pb-9 md:pb-10 bg-slate-900/98 border-t border-slate-800 space-y-3 shrink-0 shadow-2xl">
          {missingParcelIds.length > 0 && (
            <div className="p-2.5 bg-rose-950/70 border border-rose-500/70 rounded-xl text-rose-200 text-xs flex items-center gap-2 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold block">تنبيه النقص التشغيلي:</span>
                تم تحديد ({missingParcelIds.length}) طرود غير موجودة بالمانافيست. سيتم إرسال إشعار فوري عاجل باللون الأحمر لفرع الانطلاق والتأثير على تقرير العجز.
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={dischargeNotes}
                onChange={(e) => setDischargeNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات بخصوص حالة التفريغ أو التغليف (اختياري)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                إلغاء والعودة
              </button>

              <button
                type="button"
                id="btn_full_discharge_manifest"
                onClick={async () => {
                  const ok = await ensureServerConnected();
                  if (!ok) return;
                  setIsSubmitting(true);
                  const allParcelIds = manifestParcels.map((p) => p.id);
                  completeTruckDischarge(
                    manifest.id,
                    allParcelIds.length > 0 ? allParcelIds : (manifest.parcelIds || []),
                    [],
                    dischargeNotes.trim() ? dischargeNotes : 'تفريغ كامل — جميع الطرود مستلمة'
                  );
                  setIsSubmitting(false);
                  onClose();
                  if (onDischarged) {
                    onDischarged();
                  }
                }}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer border border-emerald-400/40"
                title="تفريغ كامل فوري — تأكيد استلام جميع الطرود دون أي نقص"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-100" />
                <span>✅ تفريغ كامل (جميع الطرود مستلمة)</span>
              </button>

              <button
                type="button"
                id="btn_confirm_receive_manifest"
                onClick={handleSubmitDischarge}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-500 hover:to-cyan-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer border border-teal-400/30"
                title="اعتماد التفريغ بحسب القائمة المحددة أعلاه"
              >
                <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-teal-200" />
                <span>
                  {missingParcelIds.length > 0
                    ? `تفريغ مع توثيق نقص (${missingParcelIds.length}) طرد ◄`
                    : 'تأكيد المطابقة والتفريغ ◄'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
