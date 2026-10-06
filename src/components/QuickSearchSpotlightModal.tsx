import React, { useState, useEffect, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Search,
  Package,
  X,
  ArrowUpRight,
  Printer,
  Copy,
  Check,
  MapPin,
  Phone,
  User,
  CreditCard,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import { Parcel } from '../types';
import { extractCleanTrackingQuery } from '../utils/BarcodeScannerUtility';
import { getParcelPaymentSummary } from '../utils/settlementMath';

interface QuickSearchSpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (targetModule: any) => void;
}

export const QuickSearchSpotlightModal: React.FC<QuickSearchSpotlightModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { parcels, currentBranch, currentUser, setSelectedParcelForQuickView, openPrintModal, formatCurrency } = useOrca();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'tracking' | 'person' | 'phone' | 'national_id'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global key listener for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();
  const cleanTrackingQuery = query.trim() ? extractCleanTrackingQuery(query).toLowerCase() : '';

  // Branch data isolation & App Manager access
  const isAppManager = currentUser.role === 'super_admin';
  const allowedParcels = isAppManager
    ? parcels
    : parcels.filter((p) => p.originHubId === currentBranch.id || p.destinationHubId === currentBranch.id);

  const filteredParcels = allowedParcels.filter((p) => {
    if (!normalizedQuery) return true;

    const matchesTracking =
      p.trackingNumber.toLowerCase().includes(normalizedQuery) ||
      (cleanTrackingQuery && p.trackingNumber.toLowerCase().includes(cleanTrackingQuery)) ||
      (p.paperReceiptNumber && (
        p.paperReceiptNumber.toLowerCase().includes(normalizedQuery) ||
        (cleanTrackingQuery && p.paperReceiptNumber.toLowerCase().includes(cleanTrackingQuery))
      )) ||
      p.id.toLowerCase() === normalizedQuery ||
      (cleanTrackingQuery && p.id.toLowerCase() === cleanTrackingQuery);

    const matchesPerson =
      p.sender.name.toLowerCase().includes(normalizedQuery) ||
      p.receiver.name.toLowerCase().includes(normalizedQuery);

    const matchesPhone =
      p.sender.phone.includes(normalizedQuery) || p.receiver.phone.includes(normalizedQuery);

    const matchesNationalId =
      p.sender.nationalId && p.sender.nationalId.includes(normalizedQuery);

    if (activeFilter === 'tracking') return matchesTracking;
    if (activeFilter === 'person') return matchesPerson;
    if (activeFilter === 'phone') return matchesPhone;
    if (activeFilter === 'national_id') return matchesNationalId;

    return matchesTracking || matchesPerson || matchesPhone || matchesNationalId;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received_at_origin_hub':
        return { label: 'بمركز الانطلاق', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'loaded_in_truck':
        return { label: 'محمل بالشاحنة', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'in_transit':
        return { label: 'في الطريق بالمسار', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
      case 'arrived_at_dest_hub':
        return { label: 'بمستودع الوجهة', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'out_for_delivery':
        return { label: 'مع المندوب للتسليم', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'delivered':
        return { label: 'تم التسليم للزبون', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      default:
        return { label: status, color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' };
    }
  };

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenPrint = (parcel: Parcel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAppManager) return;
    openPrintModal('parcel_3part', parcel);
  };

  return (
    <div
      id="quick-search-spotlight-overlay"
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="quick-search-spotlight-modal"
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Large Prominent Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="relative flex items-center">
            <Search className="w-6 h-6 text-cyan-400 absolute right-4 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              id="spotlight-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث برمز الشحنة (ORK-...)، رقم الإيصال، اسم المرسل، المستلم، الهاتف، أو الرقم الوطني..."
              className="w-full h-14 pl-12 pr-14 bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-400 text-base sm:text-lg font-medium rounded-xl outline-none transition-all shadow-inner"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-slate-400 flex items-center gap-1 pl-1">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                تصفية حسب:
              </span>
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-lg border font-medium transition-all ${
                  activeFilter === 'all'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                الكل ({parcels.length})
              </button>
              <button
                onClick={() => setActiveFilter('tracking')}
                className={`px-3 py-1 rounded-lg border font-medium transition-all ${
                  activeFilter === 'tracking'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                رمز الشحنة / الإيصال
              </button>
              <button
                onClick={() => setActiveFilter('person')}
                className={`px-3 py-1 rounded-lg border font-medium transition-all ${
                  activeFilter === 'person'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                المرسل / المستلم
              </button>
              <button
                onClick={() => setActiveFilter('phone')}
                className={`px-3 py-1 rounded-lg border font-medium transition-all ${
                  activeFilter === 'phone'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                رقم الهاتف
              </button>
              <button
                onClick={() => setActiveFilter('national_id')}
                className={`px-3 py-1 rounded-lg border font-medium transition-all ${
                  activeFilter === 'national_id'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                الرقم الوطني
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
              اضغط <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">ESC</kbd> للإغلاق
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredParcels.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">لا توجد نتائج مطابقة لبحثك</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                تأكد من كتابة رمز الطرد بشكل صحيح أو جزء من اسم المرسل أو المستلم أو رقم هاتفه.
              </p>
            </div>
          ) : (
            filteredParcels.map((parcel) => {
              const statusBadge = getStatusBadge(parcel.handlingStatus);
              return (
                <div
                  key={parcel.id}
                  id={`spotlight-parcel-card-${parcel.id}`}
                  onClick={() => {
                    setSelectedParcelForQuickView(parcel);
                    onClose();
                  }}
                  className="bg-slate-950/70 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 sm:p-4 cursor-pointer transition-all duration-150 shadow-md group hover:shadow-cyan-950/30"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left/Main info */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Package className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        {/* Codes & Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-cyan-300 text-sm group-hover:text-cyan-200">
                            {parcel.trackingNumber}
                          </span>
                          {parcel.paperReceiptNumber && (
                            <span className="text-[11px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono border border-slate-700">
                              إيصال ورقي: {parcel.paperReceiptNumber}
                            </span>
                          )}
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {parcel.packageType}
                          </span>
                        </div>

                        {/* Sender -> Receiver Info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">المرسل:</span>
                            <span className="font-bold text-white">{parcel.sender.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">({parcel.sender.phone})</span>
                            <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                              {parcel.sender.city}
                            </span>
                          </div>

                          <span className="text-slate-500 font-bold">◄</span>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">المستلم:</span>
                            <span className="font-bold text-white">{parcel.receiver.name}</span>
                            <span className="text-slate-400 font-mono text-[11px]">({parcel.receiver.phone})</span>
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                              {parcel.receiver.city}
                            </span>
                          </div>
                        </div>

                        {/* Parcel Core Specs (Weight, Count, Dates) */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 pt-1 border-t border-slate-850/80">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">عدد الطرود:</span>
                            <strong className="text-cyan-300 font-bold font-mono">{parcel.piecesCount || 1} طرد</strong>
                          </div>
                          <span className="text-slate-600">•</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">الوزن:</span>
                            <strong className="text-amber-300 font-bold font-mono">{parcel.weightKg} كغ</strong>
                          </div>
                          <span className="text-slate-600">•</span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-slate-400">تاريخ التسجيل:</span>
                            <span className="text-slate-200 font-mono">
                              {parcel.createdAt ? new Date(parcel.createdAt).toLocaleDateString('ar-SY', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                            </span>
                          </div>
                          <span className="text-slate-600">•</span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-slate-400">تاريخ التسليم:</span>
                            <span className={`font-mono font-medium ${parcel.deliveredAt ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                              {parcel.deliveredAt
                                ? new Date(parcel.deliveredAt).toLocaleDateString('ar-SY', { year: 'numeric', month: '2-digit', day: '2-digit' })
                                : (parcel.handlingStatus === 'delivered' ? 'تم التسليم' : 'قيد المعالجة والتوصيل')}
                            </span>
                          </div>
                          {parcel.sender.nationalId && (
                            <>
                              <span className="text-slate-600">•</span>
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="text-slate-400">الرقم الوطني:</span>
                                <strong className="text-cyan-300 font-mono">{parcel.sender.nationalId}</strong>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Financials & Quick Action Buttons */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60 shrink-0">
                      <div className="text-right md:text-left">
                        <div className="text-[10px] text-slate-400">المبلغ المطلوب</div>
                        <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
                          {getParcelPaymentSummary(parcel).summaryDueText}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {parcel.paymentType === 'prepaid' ? 'مدفوع مسبقاً' : parcel.paymentType === 'collect' ? 'أجور عند التسليم' : 'حوالة ضد الدفع COD'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(parcel.trackingNumber, parcel.id, e)}
                          title="نسخ رقم التتبع"
                          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedId === parcel.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {isAppManager && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenPrint(parcel, e)}
                            title="طباعة البوليصة A4"
                            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          id={`btn_view_parcel_${parcel.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParcelForQuickView(parcel);
                            onClose();
                          }}
                          className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30 cursor-pointer"
                        >
                          <span>استعلام وتفاصيل الشحنة</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with summary */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between px-5">
          <span>
            يتم عرض <strong>{filteredParcels.length}</strong> من أصل <strong>{parcels.length}</strong> طرد في قاعدة البيانات
          </span>
          <span className="text-cyan-400 font-medium">
            نظام أوركا للشحن • محرك البحث السريع الموحد
          </span>
        </div>
      </div>
    </div>
  );
};
