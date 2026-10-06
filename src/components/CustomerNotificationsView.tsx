import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { SystemNotification, Parcel } from '../types';
import {
  Bell,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  DollarSign,
  AlertCircle,
  Package,
  CheckCheck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  Info,
  Layers,
  X,
  Phone,
  ShieldCheck,
  Send,
  PackageCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerNotificationsViewProps {
  onSelectParcel?: (parcel: Parcel) => void;
  onCloseModal?: () => void;
  isEmbedded?: boolean;
}

export const CustomerNotificationsView: React.FC<CustomerNotificationsViewProps> = ({
  onSelectParcel,
  onCloseModal,
  isEmbedded = false,
}) => {
  const {
    currentCustomer,
    getCustomerNotifications,
    getCustomerParcels,
    markNotificationRead,
    markAllNotificationsRead,
    formatCurrency,
    brandingSettings,
    branches,
  } = useOrca();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'status' | 'cod' | 'alert'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<SystemNotification | null>(null);

  const notifications = useMemo(() => {
    return getCustomerNotifications();
  }, [getCustomerNotifications]);

  const { all: customerParcels } = useMemo(() => {
    return getCustomerParcels();
  }, [getCustomerParcels]);

  // Parcel lookup map for fast association
  const parcelMap = useMemo(() => {
    const map = new Map<string, Parcel>();
    customerParcels.forEach((p) => {
      map.set(p.id, p);
      map.set(p.trackingNumber, p);
    });
    return map;
  }, [customerParcels]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // 1. Tab filter
      if (activeFilter === 'unread' && notif.read) return false;
      if (activeFilter === 'status') {
        const isStatusType =
          notif.type === 'truck_dispatched' ||
          notif.type === 'truck_arrived' ||
          notif.type === 'system' ||
          notif.type === 'info';
        if (!isStatusType) return false;
      }
      if (activeFilter === 'cod') {
        const isCodType =
          notif.type === 'cod_payout_due' ||
          notif.type === 'cash_settlement' ||
          notif.actionType === 'cod_payout_sender' ||
          notif.title.includes('COD') ||
          notif.title.includes('حوالة') ||
          notif.title.includes('صرف');
        if (!isCodType) return false;
      }
      if (activeFilter === 'alert') {
        const isAlertType =
          notif.priority === 'urgent' ||
          notif.priority === 'important' ||
          notif.type === 'overdue_storage' ||
          notif.type === 'shortage_alert' ||
          notif.type === 'sla_warning' ||
          notif.title.includes('🚨') ||
          notif.title.includes('تنبيه');
        if (!isAlertType) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTitle = notif.title.toLowerCase().includes(query);
        const matchMessage = notif.message.toLowerCase().includes(query);
        const matchTracking =
          notif.parcelSummary?.trackingNumber?.toLowerCase().includes(query) ||
          (notif.relatedId && notif.relatedId.toLowerCase().includes(query));
        const matchSender = notif.senderName?.toLowerCase().includes(query);
        if (!matchTitle && !matchMessage && !matchTracking && !matchSender) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'المركز الرئيسي';
    const b = branches.find((item) => item.id === branchId || item.code === branchId);
    return b ? b.name : branchId;
  };

  const getNotificationIcon = (notif: SystemNotification) => {
    if (notif.type === 'cod_payout_due' || notif.actionType === 'cod_payout_sender' || notif.title.includes('صرف')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/40">
          <DollarSign className="w-5 h-5" />
        </div>
      );
    }
    if (notif.type === 'truck_dispatched') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-md shadow-amber-950/40">
          <Truck className="w-5 h-5" />
        </div>
      );
    }
    if (notif.type === 'truck_arrived') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-md shadow-indigo-950/40">
          <Building2 className="w-5 h-5" />
        </div>
      );
    }
    if (notif.type === 'cash_settlement') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-md shadow-cyan-950/40">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      );
    }
    if (notif.type === 'manifest_unloaded' || notif.title.includes('تفريغ')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-md shadow-orange-950/40">
          <PackageCheck className="w-5 h-5" />
        </div>
      );
    }
    if (notif.priority === 'urgent' || notif.type === 'overdue_storage' || notif.type === 'shortage_alert') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-md shadow-rose-950/40">
          <AlertCircle className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-2xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center shrink-0 shadow-md">
        <Package className="w-5 h-5" />
      </div>
    );
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    if (!notif.read) {
      markNotificationRead(notif.id);
    }
    setSelectedNotif(notif);
  };

  const handleViewRelatedParcel = (notif: SystemNotification) => {
    let targetParcel: Parcel | undefined;
    if (notif.relatedId) {
      targetParcel = parcelMap.get(notif.relatedId);
    }
    if (!targetParcel && notif.parcelSummary?.trackingNumber) {
      targetParcel = parcelMap.get(notif.parcelSummary.trackingNumber);
    }
    if (targetParcel && onSelectParcel) {
      onSelectParcel(targetParcel);
      if (onCloseModal) onCloseModal();
    }
  };

  return (
    <div className={`flex flex-col h-full ${isEmbedded ? '' : 'p-3 sm:p-5'}`} dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-indigo-950/50 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">رسائل وإشعارات التحديثات الشخصية</h2>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black animate-pulse">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              تحديثات فورية ومباشرة لحالات طرودك وحوالاتك المستحقة فور قيام الموظف بتعديلها
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {unreadCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={markAllNotificationsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700/80 transition-all shadow-sm"
              title="تحديد الكل كمقروء"
            >
              <CheckCheck className="w-4 h-4 text-indigo-400" />
              <span>تحديد الكل كمقروء</span>
            </motion.button>
          )}
          {onCloseModal && (
            <button
              onClick={onCloseModal}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Tabs & Search Bar */}
      <div className="pt-3 pb-3 space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في نص الإشعار، رقم البوليصة، أو التنبيهات..."
            className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl pr-10 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/50'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>جميع الإشعارات ({notifications.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              activeFilter === 'unread'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>غير مقروءة ({unreadCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('cod')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              activeFilter === 'cod'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>حوالات COD وصرف مالي</span>
          </button>

          <button
            onClick={() => setActiveFilter('status')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              activeFilter === 'status'
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/50'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>حركة ونقل الشحنات</span>
          </button>

          <button
            onClick={() => setActiveFilter('alert')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              activeFilter === 'alert'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-950/50'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>تنبيهات هامة وعاجلة</span>
          </button>
        </div>
      </div>

      {/* Main Notification Messages List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
        {filteredNotifications.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-8 text-center space-y-3 my-4">
            <div className="w-14 h-14 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">لا توجد إشعارات تطابق اختيارك</p>
              <p className="text-xs text-slate-400 mt-1">
                ستصلك هنا رسائل فورية كلما قام الموظف بتحديث حركة طرودك أو جاهزية مستحقاتك المالية.
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const hasLinkedParcel =
              (notif.relatedId && parcelMap.has(notif.relatedId)) ||
              (notif.parcelSummary?.trackingNumber && parcelMap.has(notif.parcelSummary.trackingNumber));

            const isCodNotification =
              notif.type === 'cod_payout_due' ||
              notif.actionType === 'cod_payout_sender' ||
              notif.title.includes('صرف') ||
              notif.title.includes('COD');

            return (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleNotificationClick(notif)}
                className={`cursor-pointer rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 relative group overflow-hidden ${
                  !notif.read
                    ? 'bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/30 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                    : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Unread Accent Dot */}
                {!notif.read && (
                  <div className="absolute top-3.5 left-3.5 w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shadow-sm shadow-indigo-400/80" />
                )}

                <div className="flex items-start gap-3.5">
                  {getNotificationIcon(notif)}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-xs sm:text-sm font-bold leading-snug ${
                          !notif.read ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 whitespace-nowrap bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800/80">
                        {new Date(notif.timestamp).toLocaleDateString('ar-SY', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Notification Body Message */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{notif.message}</p>

                    {/* Metadata Badges & Instant Actions */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                      {notif.senderName && (
                        <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-950/50 px-2 py-0.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500">الموظف المسؤول:</span>
                          <span className="text-slate-300 font-semibold">{notif.senderName}</span>
                        </span>
                      )}

                      {notif.parcelSummary?.trackingNumber && (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-500/30">
                          <span>📦 {notif.parcelSummary.trackingNumber}</span>
                        </span>
                      )}

                      {isCodNotification && notif.parcelSummary?.amountSummary && (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          <span>💰 {notif.parcelSummary.amountSummary}</span>
                        </span>
                      )}

                      {hasLinkedParcel && onSelectParcel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRelatedParcel(notif);
                          }}
                          className="mr-auto inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 transition-colors"
                        >
                          <span>عرض تفاصيل الشحنة</span>
                          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Notification Details Drawer / Modal */}
      <AnimatePresence>
        {selectedNotif && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={() => setSelectedNotif(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  {getNotificationIcon(selectedNotif)}
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedNotif.title}</h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {new Date(selectedNotif.timestamp).toLocaleString('ar-SY')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 leading-relaxed">
                {selectedNotif.message}
              </div>

              {selectedNotif.parcelSummary && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>رقم التتبع:</span>
                    <span className="font-mono font-bold text-white">{selectedNotif.parcelSummary.trackingNumber}</span>
                  </div>
                  {selectedNotif.parcelSummary.receiverName && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>اسم المستلم:</span>
                      <span className="font-bold text-white">{selectedNotif.parcelSummary.receiverName}</span>
                    </div>
                  )}
                  {selectedNotif.parcelSummary.amountSummary && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>المبلغ المستحق:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {selectedNotif.parcelSummary.amountSummary}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                {((selectedNotif.relatedId && parcelMap.has(selectedNotif.relatedId)) ||
                  (selectedNotif.parcelSummary?.trackingNumber &&
                    parcelMap.has(selectedNotif.parcelSummary.trackingNumber))) &&
                  onSelectParcel && (
                    <button
                      type="button"
                      onClick={() => {
                        handleViewRelatedParcel(selectedNotif);
                        setSelectedNotif(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-950/50"
                    >
                      فتح ملف الشحنة بالتفصيل
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
