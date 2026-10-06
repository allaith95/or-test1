import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  MapPin,
  Building2,
  FileText,
  User,
  Phone,
  Clock,
  ShieldAlert,
  ArrowRightLeft,
  Info,
  Volume2,
} from 'lucide-react';

export const ShortageResolutionModal: React.FC = () => {
  const {
    isShortageResolutionModalOpen,
    shortageResolutionParcelIds,
    closeShortageResolutionModal,
    parcels,
    branches,
    truckManifests,
    resolveShortageAtOrigin,
    formatCurrency,
    playShortageAlertSound,
  } = useOrca();

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'found_at_origin' | 'lost_in_transit' | null>(null);

  // Automatically play distinctive urgent audio alert when shortage modal is opened
  useEffect(() => {
    if (isShortageResolutionModalOpen && shortageResolutionParcelIds.length > 0) {
      playShortageAlertSound();
    }
  }, [isShortageResolutionModalOpen, shortageResolutionParcelIds]);

  if (!isShortageResolutionModalOpen || shortageResolutionParcelIds.length === 0) {
    return null;
  }

  const missingParcels = parcels.filter((p) => shortageResolutionParcelIds.includes(p.id));
  if (missingParcels.length === 0) {
    return null;
  }

  const firstParcel = missingParcels[0];
  const manifest = firstParcel.shortageManifestId
    ? truckManifests.find((m) => m.id === firstParcel.shortageManifestId)
    : null;
  const originBranch = branches.find((b) => b.id === firstParcel.originHubId);
  const destBranch = branches.find((b) => b.id === firstParcel.destinationHubId);

  const handleConfirm = (resolution: 'found_at_origin' | 'lost_in_transit') => {
    setIsSubmitting(true);
    try {
      resolveShortageAtOrigin(shortageResolutionParcelIds, resolution, notes);
      closeShortageResolutionModal();
      setNotes('');
      setSelectedResolution(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-amber-950/50 overflow-hidden text-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 p-5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">تأكيد حالة النقص للفرع الصادر</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  تنبيه عاجل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                أبلغ فرع الوجهة ({destBranch?.name || 'الوجهة'}) عن نقص في حمولة الشاحنة. يرجى التحقق من المستودع الصادر.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={playShortageAlertSound}
              title="إعادة تشغيل صوت التنبيه"
              className="p-1.5 text-amber-300 hover:text-amber-100 rounded-lg hover:bg-amber-950/60 border border-amber-500/30 transition flex items-center gap-1 text-xs"
            >
              <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline text-[11px] font-bold">صوت التنبيه</span>
            </button>
            <button
              onClick={closeShortageResolutionModal}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Manifest & Route Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">رقم المانافيست</span>
                <span className="font-mono font-bold text-white text-xs">
                  {manifest?.manifestNumber || firstParcel.shortageManifestNumber || 'غير محدد'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">فرع الانطلاق (الصادر)</span>
                <span className="font-bold text-white text-xs">{originBranch?.name || 'المركز الصادر'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">فرع الاستلام (المُبلِغ)</span>
                <span className="font-bold text-white text-xs">{destBranch?.name || 'مركز الاستلام'}</span>
              </div>
            </div>
          </div>

          {/* Missing Parcels List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-rose-400" />
                <span>الطرود المسجلة كنقص ({missingParcels.length}):</span>
              </span>
              <span className="text-slate-400 text-[11px]">
                تاريخ الإبلاغ: {firstParcel.shortageReportedAt ? new Date(firstParcel.shortageReportedAt).toLocaleString('ar-SY') : 'الآن'}
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {missingParcels.map((parcel) => (
                <div
                  key={parcel.id}
                  className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 hover:border-rose-500/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-rose-400 text-sm">
                        {parcel.trackingNumber}
                      </span>
                      {parcel.paperReceiptNumber && (
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          ورقي: {parcel.paperReceiptNumber}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                        {parcel.packageType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      الوصف: <strong className="text-white">{parcel.contentDescription || 'بضاعة عامة'}</strong> - الوزن: {parcel.weightKg} كغ ({parcel.piecesCount} قطع)
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0 border-t sm:border-t-0 sm:border-r sm:border-slate-800 pt-2 sm:pt-0 sm:pr-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block">المرسل</span>
                      <span className="text-white font-medium">{parcel.sender.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">المستلم</span>
                      <span className="text-white font-medium">{parcel.receiver.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">القيمة المالية</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(parcel.totalDue || parcel.shippingCost, parcel.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt / Explanation */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
              <strong className="block text-amber-300">توجيه إدارة العمليات والتحقق من النقص:</strong>
              <p>
                1. <strong>إذا كان الطرد متواجداً بمستودع الصادر (موجود):</strong> اختر &quot;الطرد موجود لدينا&quot;، وسيعود فوراً إلى <em>القسم الصادر</em> ويصبح جاهزاً للتحميل في مانافيست جديدة مع إشارة مميزة توضح أنه <em>(ناقص من شحنة سابقة)</em>.
              </p>
              <p>
                2. <strong>إذا تم التأكد من فقدانه على الطريق (مفقود):</strong> اختر &quot;غير موجود لدينا / فُقد على الطريق&quot; ليتم ترحيل البوليصة فوراً إلى <em>&quot;مستودع الفقد والتسويات&quot;</em> للشروع بإجراءات التعويض والتسوية المالية لاحقاً.
              </p>
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              ملاحظات التحقق والمستودع (اختياري):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تم العثور على الطرد بالفرع الصادر وهو سليم وجاهز للشحن بالمانافيست القادم..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950/90 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={closeShortageResolutionModal}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
          >
            إغلاق ومراجعة لاحقاً
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Option 1: Found at Origin */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirm('found_at_origin')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 border border-emerald-400/40 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>الطرد موجود لدينا (إعادة للصادر والتحميل)</span>
            </button>

            {/* Option 2: Lost in Transit */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirm('lost_in_transit')}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 border border-rose-400/40 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4 text-rose-200" />
              <span>غير موجود (ترحيل لمستودع الفقد)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
