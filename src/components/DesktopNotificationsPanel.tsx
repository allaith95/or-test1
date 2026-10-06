import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Bell,
  CheckCheck,
  CheckCircle,
  X,
  AlertTriangle,
  Info,
  ShieldCheck,
  Wallet,
  Coins,
  Truck,
  Search,
  PackageCheck,
  AlertOctagon,
  Navigation,
  Sparkles,
  Flame,
} from 'lucide-react';
import { getNotificationCategory } from '../utils/notificationCategoryHelper';

interface DesktopNotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopNotificationsPanel: React.FC<DesktopNotificationsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isolatedNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    openCashierCollectModal,
    openCodSenderPayoutModal,
    openShortageResolutionModal,
    setActiveModule,
  } = useOrca();

  // اختصار الفرز إلى 3 تبويبات رئيسية بدون سكرول: الكل، غير مقروء، عمليات وهامة
  const [notifTab, setNotifTab] = useState<'all' | 'unread' | 'priority'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const unreadNotifCount = isolatedNotifications.filter((n) => !n.read).length;

  const isPriorityItem = (n: typeof isolatedNotifications[0]) => {
    const cat = getNotificationCategory(n);
    return (
      cat === 'remittance' ||
      cat === 'loss' ||
      cat === 'truck_departure' ||
      cat === 'truck_arrival' ||
      cat === 'manifest_unloaded' ||
      n.type === 'cod_payout_due' ||
      n.type === 'cod_payout_sender' ||
      n.type === 'shortage_alert' ||
      n.type === 'lost_parcel' ||
      n.type === 'truck_dispatched' ||
      n.type === 'truck_arrived' ||
      n.type === 'manifest_unloaded' ||
      n.type === 'admin_directive' ||
      n.type === 'direct_message' ||
      n.priority === 'urgent' ||
      n.priority === 'important' ||
      n.actionType === 'cashier_collect' ||
      n.actionType === 'cod_payout_sender' ||
      n.actionType === 'verify_shortage' ||
      n.actionType === 'view_shortage_warehouse'
    );
  };

  const priorityCount = useMemo(() => {
    return isolatedNotifications.filter((n) => isPriorityItem(n)).length;
  }, [isolatedNotifications]);

  const filteredNotifications = useMemo(() => {
    return [...isolatedNotifications]
      .filter((n) => {
        // 1. فلتر البحث
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (n.title || '').toLowerCase().includes(q);
          const matchMsg = (n.message || '').toLowerCase().includes(q);
          const matchTracking = (n.relatedId || '').toLowerCase().includes(q);
          const matchSender = (n.parcelSummary?.senderName || '').toLowerCase().includes(q);
          const matchReceiver = (n.parcelSummary?.receiverName || '').toLowerCase().includes(q);
          if (!matchTitle && !matchMsg && !matchTracking && !matchSender && !matchReceiver) {
            return false;
          }
        }

        // 2. التبويبات الثلاثة
        if (notifTab === 'unread') return !n.read;
        if (notifTab === 'priority') return isPriorityItem(n);
        return true; // 'all'
      })
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [isolatedNotifications, notifTab, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      <div
        id="fluent_notifications_panel"
        className="fixed bottom-16 left-3 sm:left-6 w-[360px] sm:w-[440px] max-w-[calc(100vw-24px)] bg-slate-900/98 backdrop-blur-3xl border border-slate-700/80 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-5 duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                <span>مركز التنبيهات</span>
                {unreadNotifCount > 0 && (
                  <span className="text-[10px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded-full font-mono shrink-0 animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                تنبيهات الفرع والدور والمستندات التشغيلية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* زر البحث الصغير */}
            <button
              type="button"
              id="btn_toggle_notif_search"
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
              }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                isSearchOpen || searchQuery
                  ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={isSearchOpen ? 'إغلاق البحث' : 'بحث سريع في التنبيهات'}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* زر تحديد الكل كمقروء للمستخدم الحالي فقط */}
            {isolatedNotifications.length > 0 && (
              <button
                type="button"
                id="btn_mark_all_notifications_read"
                onClick={markAllNotificationsRead}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800 transition"
                title="تحديد التنبيهات كمقروءة لك فقط"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مقروء للكل</span>
              </button>
            )}

            {/* زر إغلاق اللوحة */}
            <button
              type="button"
              id="btn_close_notifications_panel"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Small Search Bar (يظهر بنقرة أو عند وجود نص بحث) */}
        {(isSearchOpen || searchQuery) && (
          <div className="px-3 py-2 bg-slate-950/70 border-b border-slate-800 animate-in fade-in duration-150">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="بحث برقم الشحنة، الحوالة، البيان أو النص..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-7 pl-7 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3 Main Tabs (بدون سكرول - شبكة متناسقة وثابتة) */}
        <div className="p-2 border-b border-slate-800/80 bg-slate-950/60">
          <div className="grid grid-cols-3 gap-1 text-[11px]">
            {/* تبويب 1: الكل */}
            <button
              type="button"
              id="tab_notif_all"
              onClick={() => setNotifTab('all')}
              className={`py-1.5 px-2 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                notifTab === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm font-black'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>الكل</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                notifTab === 'all' ? 'bg-cyan-900/60 text-cyan-100' : 'bg-slate-900 text-slate-400'
              }`}>
                {isolatedNotifications.length}
              </span>
            </button>

            {/* تبويب 2: غير مقروء */}
            <button
              type="button"
              id="tab_notif_unread"
              onClick={() => setNotifTab('unread')}
              className={`py-1.5 px-2 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                notifTab === 'unread'
                  ? 'bg-rose-600 text-white shadow-sm font-black'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>غير مقروء</span>
              {unreadNotifCount > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-rose-950 text-rose-200 border border-rose-400/40 font-black">
                  {unreadNotifCount}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-900 text-slate-500">
                  0
                </span>
              )}
            </button>

            {/* تبويب 3: هامة وعمليات (حوالات، فقدان، شاحنات، مانافيست) */}
            <button
              type="button"
              id="tab_notif_priority"
              onClick={() => setNotifTab('priority')}
              className={`py-1.5 px-2 rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                notifTab === 'priority'
                  ? 'bg-amber-600 text-white shadow-sm font-black'
                  : 'bg-slate-800/60 text-amber-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-300 shrink-0" />
              <span>هامة وعمليات</span>
              {priorityCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  notifTab === 'priority' ? 'bg-amber-950 text-amber-100' : 'bg-slate-900 text-amber-400'
                }`}>
                  {priorityCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800">
              <CheckCircle className="w-9 h-9 text-slate-600 mx-auto mb-2 opacity-60" />
              <div className="font-bold text-slate-400 mb-1">
                {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا توجد تنبيهات في هذا التبويب'}
              </div>
              <p className="text-[11px] text-slate-500">
                كافة العمليات الميدانية وشحنات الفرع تسير بانتظام
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const cat = getNotificationCategory(n);

              // Styling per notification type & read status
              let cardBgBorder = 'bg-slate-900/90 border-slate-800 text-slate-300';
              let badgeTag: React.ReactNode = null;
              let catIcon: React.ReactNode = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;

              if (!n.read) {
                if (cat === 'loss') {
                  cardBgBorder = 'bg-gradient-to-r from-rose-950 via-red-950 to-slate-950 border-2 border-rose-500 text-rose-100 shadow-2xl shadow-rose-600/80 ring-2 ring-rose-500/70 animate-pulse';
                  badgeTag = (
                    <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md shadow-rose-600/80">
                      <AlertOctagon className="w-3 h-3 text-white" />
                      <span>تنبيه فقدان (عاجل)</span>
                    </span>
                  );
                  catIcon = <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
                } else if (cat === 'remittance') {
                  cardBgBorder = 'bg-gradient-to-r from-red-950/90 via-rose-950/80 to-slate-950 border-2 border-red-500 text-rose-100 shadow-xl shadow-red-950/80 ring-1 ring-red-500/50';
                  badgeTag = (
                    <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Wallet className="w-3 h-3 text-white" />
                      <span>تنبيه حوالة</span>
                    </span>
                  );
                  catIcon = <Coins className="w-4 h-4 text-red-400 shrink-0" />;
                } else if (cat === 'truck_departure') {
                  cardBgBorder = 'bg-gradient-to-r from-emerald-950/90 via-green-950/80 to-slate-950 border-2 border-emerald-500 text-emerald-100 shadow-xl shadow-emerald-950/80 ring-1 ring-emerald-500/50';
                  badgeTag = (
                    <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <Navigation className="w-3 h-3 text-white" />
                      <span>مغادرة سيارة</span>
                    </span>
                  );
                  catIcon = <Truck className="w-4 h-4 text-emerald-400 shrink-0" />;
                } else if (cat === 'truck_arrival') {
                  cardBgBorder = 'bg-gradient-to-r from-blue-950/90 via-cyan-950/80 to-slate-950 border-2 border-blue-500 text-blue-100 shadow-xl shadow-blue-950/80 ring-1 ring-blue-500/50';
                  badgeTag = (
                    <span className="text-[10px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <CheckCircle className="w-3 h-3 text-white" />
                      <span>وصول شاحنة</span>
                    </span>
                  );
                  catIcon = <Truck className="w-4 h-4 text-blue-400 shrink-0" />;
                } else if (cat === 'manifest_unloaded') {
                  cardBgBorder = 'bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-slate-950 border-2 border-orange-500 text-orange-100 shadow-xl shadow-orange-950/80 ring-1 ring-orange-500/50';
                  badgeTag = (
                    <span className="text-[10px] bg-orange-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <PackageCheck className="w-3 h-3 text-white" />
                      <span>تفريغ الحملة</span>
                    </span>
                  );
                  catIcon = <PackageCheck className="w-4 h-4 text-orange-400 shrink-0" />;
                } else {
                  cardBgBorder = 'bg-slate-800/90 border-cyan-500/50 text-slate-100 shadow-sm';
                  catIcon = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
                }
              } else {
                cardBgBorder = 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850';
                if (cat === 'loss') {
                  catIcon = <AlertTriangle className="w-4 h-4 text-rose-400/80 shrink-0" />;
                  badgeTag = (
                    <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3 text-rose-400" />
                      <span>تنبيه فقدان</span>
                    </span>
                  );
                } else if (cat === 'manifest_unloaded') {
                  catIcon = <PackageCheck className="w-4 h-4 text-orange-400/80 shrink-0" />;
                  badgeTag = (
                    <span className="text-[10px] bg-orange-950/80 text-orange-300 border border-orange-500/40 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <PackageCheck className="w-3 h-3 text-orange-400" />
                      <span>تفريغ الحملة</span>
                    </span>
                  );
                } else if (cat === 'remittance') {
                  catIcon = <Coins className="w-4 h-4 text-red-400/80 shrink-0" />;
                  badgeTag = (
                    <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-500/40 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-red-400" />
                      <span>حوالة</span>
                    </span>
                  );
                } else if (cat === 'truck_departure') {
                  catIcon = <Truck className="w-4 h-4 text-emerald-400/80 shrink-0" />;
                  badgeTag = (
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-emerald-400" />
                      <span>مغادرة سيارة</span>
                    </span>
                  );
                } else if (cat === 'truck_arrival') {
                  catIcon = <Truck className="w-4 h-4 text-blue-400/80 shrink-0" />;
                  badgeTag = (
                    <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-500/40 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                      <span>وصول شاحنة</span>
                    </span>
                  );
                }
              }

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.actionType === 'cashier_collect' && n.relatedId) {
                      onClose();
                      openCashierCollectModal(n.relatedId, n.id);
                    } else if (
                      n.actionType === 'verify_shortage' &&
                      n.shortageSummary?.parcelIds &&
                      (n.shortageSummary?.missingCount ?? 0) > 0
                    ) {
                      onClose();
                      openShortageResolutionModal(n.shortageSummary.parcelIds);
                    } else if (n.actionType === 'view_shortage_warehouse') {
                      onClose();
                      setActiveModule('arrivals');
                    } else if (
                      n.actionType === 'view_manifest' ||
                      n.type === 'manifest_unloaded' ||
                      cat === 'manifest_unloaded' ||
                      n.type === 'truck_dispatched' ||
                      n.type === 'truck_arrived'
                    ) {
                      onClose();
                      setActiveModule('manifests');
                    }
                  }}
                  className={`p-3.5 rounded-2xl border text-xs transition cursor-pointer relative overflow-hidden ${cardBgBorder}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.read && (
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            cat === 'loss' || cat === 'remittance'
                              ? 'bg-rose-500 ring-4 ring-rose-500/40 animate-ping'
                              : cat === 'truck_departure'
                              ? 'bg-emerald-400 animate-pulse'
                              : cat === 'truck_arrival'
                              ? 'bg-blue-400 animate-pulse'
                              : cat === 'manifest_unloaded'
                              ? 'bg-orange-400'
                              : 'bg-cyan-400'
                          }`}
                        />
                      )}
                      {catIcon}
                      <span className={`font-bold ${!n.read ? 'text-white font-black text-xs sm:text-sm' : 'text-slate-200'}`}>
                        {n.title}
                      </span>
                      {badgeTag}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0" dir="ltr">
                      {n.timestamp
                        ? `${new Date(n.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ${new Date(n.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
                        : ''}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-2 leading-relaxed ${!n.read ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
                    {n.message}
                  </p>

                  {/* Manifest Quick View Button */}
                  {(n.actionType === 'view_manifest' ||
                    n.type === 'manifest_unloaded' ||
                    cat === 'manifest_unloaded' ||
                    n.type === 'truck_dispatched' ||
                    n.type === 'truck_arrived') && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationRead(n.id);
                          onClose();
                          setActiveModule('manifests');
                        }}
                        className={`w-full py-1.5 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                          cat === 'manifest_unloaded'
                            ? 'bg-slate-900 hover:bg-orange-950/70 text-orange-300 border border-orange-500/40 hover:border-orange-400'
                            : 'bg-slate-900 hover:bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400'
                        }`}
                      >
                        {cat === 'manifest_unloaded' ? (
                          <>
                            <PackageCheck className="w-3.5 h-3.5 text-orange-400" />
                            <span>معاينة تفريغ المانافيست والطرود المستلمة ◄</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>الانتقال لمعاينة المانافيست والطرود المحدثة ◄</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Urgent Shortage Verification Button */}
                  {n.actionType === 'verify_shortage' &&
                    n.shortageSummary &&
                    (n.shortageSummary.missingCount ?? 0) > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-amber-300">
                        <span className="font-bold">عدد الطرود الناقصة:</span>
                        <span className="font-mono font-black bg-rose-500/30 text-rose-300 px-2 py-0.5 rounded border border-rose-500/40">
                          {n.shortageSummary.missingCount} طرد
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationRead(n.id);
                          onClose();
                          openShortageResolutionModal(n.shortageSummary?.parcelIds || []);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-950/50 active:scale-95 animate-pulse"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>تأكيد النقص ومطابقة المستودع الصادر ◄</span>
                      </button>
                    </div>
                  )}

                  {/* Shortage Warehouse View Button */}
                  {n.actionType === 'view_shortage_warehouse' && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationRead(n.id);
                          onClose();
                          setActiveModule('arrivals');
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>معاينة مستودع الطرود الناقصة والتسويات ◄</span>
                      </button>
                    </div>
                  )}

                  {/* Cashier Interactive Forwarded Collection Card */}
                  {n.actionType === 'cashier_collect' && n.parcelSummary && (
                    <div className={`mt-2.5 p-3 rounded-xl border space-y-2.5 ${
                      !n.read
                        ? 'bg-slate-950/90 border-rose-500/80 shadow-md shadow-rose-950/60'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">
                          المستلم: <strong className="text-white font-bold">{n.parcelSummary.receiverName}</strong>
                        </span>
                        {n.parcelSummary.receiverPhone && (
                          <span className="text-rose-300 font-mono text-[10px] font-bold">
                            {n.parcelSummary.receiverPhone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs bg-rose-950/50 p-2 rounded-lg border border-rose-500/50 shadow-inner">
                        <span className="text-rose-300 font-bold flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-rose-400" />
                          <span>المبلغ الواجب تحصيله:</span>
                        </span>
                        <span className="font-mono font-black text-emerald-300 text-sm">
                          {n.parcelSummary.amountSummary}
                        </span>
                      </div>
                      {!n.read ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (n.relatedId) {
                              markNotificationRead(n.id);
                              onClose();
                              openCashierCollectModal(n.relatedId, n.id);
                            }
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/50 border border-rose-300/40 cursor-pointer transition active:scale-95 animate-pulse"
                        >
                          <Wallet className="w-4 h-4 text-white" />
                          <span>فتح واجهة القبض الفوري وإيداع المبلغ بالصندوق</span>
                        </button>
                      ) : (
                        <div className="w-full py-1.5 px-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>تم معالجة القبض وتوثيق إيداعه بالصندوق</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* COD Sender Remittance Payout Card (إشعار صرف حوالة COD للمرسل في الفرع الصادر) */}
                  {n.actionType === 'cod_payout_sender' && n.parcelSummary && (
                    <div className={`mt-2.5 p-3 rounded-xl border space-y-2.5 ${
                      !n.read
                        ? 'bg-gradient-to-br from-red-950/80 via-slate-950/95 to-amber-950/70 border-rose-500 shadow-lg shadow-rose-950/80 ring-1 ring-rose-500/50'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">
                          المرسل المستحق: <strong className="text-white font-bold">{n.parcelSummary.senderName}</strong>
                        </span>
                        {n.parcelSummary.senderPhone && (
                          <span className="text-amber-300 font-mono text-[10px] font-bold">
                            {n.parcelSummary.senderPhone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs bg-black/60 p-2 rounded-lg border border-rose-500/40 shadow-inner">
                        <span className="text-rose-300 font-bold flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span>قيمة الحوالة المستحقة للمرسل:</span>
                        </span>
                        <span className="font-mono font-black text-emerald-300 text-sm">
                          {n.parcelSummary.amountSummary}
                        </span>
                      </div>
                      {!n.read ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (n.relatedId) {
                              markNotificationRead(n.id);
                              onClose();
                              openCodSenderPayoutModal(n.relatedId);
                            }
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/50 border border-rose-300/40 cursor-pointer transition active:scale-95 animate-pulse"
                        >
                          <Wallet className="w-4 h-4 text-white" />
                          <span>صرف الحوالة للمرسل وإصدار سند الصرف ◄</span>
                        </button>
                      ) : (
                        <div className="w-full py-1.5 px-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>تم صرف وتسليم الحوالة للمرسل بنجاح</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
