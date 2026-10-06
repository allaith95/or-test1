import React, { useState, useEffect, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import { NetworkLatencyIndicator } from './NetworkLatencyIndicator';
import { OrcaLogo } from './OrcaLogo';
import {
  Building2,
  ChevronDown,
  Bell,
  Search,
  Maximize2,
  Minimize2,
  User as UserIcon,
  Shield,
  LogOut,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  Lock,
  Clock,
  Radio,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  CloudLightning,
} from 'lucide-react';
import { QuickSearchSpotlightModal } from './QuickSearchSpotlightModal';
import { AdminDirectivesModal } from './AdminDirectivesModal';
import { DirectiveChatPopover } from './DirectiveChatPopover';

import { Server } from 'lucide-react';
import { deriveConnectionState } from '../utils/connectionState';

export const MacTopBar: React.FC = () => {
  const {
    currentBranch,
    setCurrentBranch,
    branches,
    branchesWithDerivedBalances,
    currentUser,
    notifications,
    isolatedNotifications,
    directMessages,
    markNotificationRead,
    markAllNotificationsRead,
    markDirectMessageRead,
    openCashierCollectModal,
    openCodSenderPayoutModal,
    hasPermission,
    canSwitchBranch,
    setActiveModule,
    brandingSettings,
    logout,
    formatCurrency,
    formatExchangeRate,
    cloudSyncState,
    boundBranchId,
  } = useOrca();

  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isChatPopoverOpen, setIsChatPopoverOpen] = useState(false);
  const [activeChatDirectiveId, setActiveChatDirectiveId] = useState<string | null>(null);
  const [notifFilter, setNotifFilter] = useState<'all' | 'directives' | 'system'>('all');
  const [isDirectivesModalOpen, setIsDirectivesModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? !!document.fullscreenElement : false
  );

  // Synchronize fullscreen state on changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [selectedDirectiveId, setSelectedDirectiveId] = useState<string | undefined>(undefined);

  // Live Syrian Time Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-SY', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('ar-SY', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Spotlight Keyboard Shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const accessibleDirectives = directMessages
    .filter((msg) => {
      if (currentUser.role === 'super_admin') return true;
      if (msg.senderUserId === currentUser.id) return true;
      if (msg.recipientType === 'user' && msg.recipientUserId === currentUser.id) return true;
      if (
        msg.recipientType === 'branch' &&
        ((currentBranch && msg.recipientBranchId === currentBranch.id) ||
          currentUser.allowedBranchIds?.includes(msg.recipientBranchId || ''))
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = isolatedNotifications.filter((n) => !n.read).length;
  const unreadDirectivesCount = accessibleDirectives.filter(
    (m) => !m.isRead && m.senderUserId !== currentUser.id
  ).length;
  const totalUnreadCount = unreadCount + unreadDirectivesCount;

  // Cashier payment alert notifications
  const unreadCashierCollectNotifs = isolatedNotifications.filter(
    (n) => !n.read && (n.actionType === 'cashier_collect' || n.type === 'cash_settlement')
  );
  const hasUnreadCashierCollect = unreadCashierCollectNotifs.length > 0;
  const prevCashierNotifCountRef = useRef(0);

  useEffect(() => {
    prevCashierNotifCountRef.current = unreadCashierCollectNotifs.length;
  }, [hasUnreadCashierCollect, unreadCashierCollectNotifs.length]);

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    accessibleDirectives.forEach((m) => {
      if (!m.isRead && m.senderUserId !== currentUser.id) {
        markDirectMessageRead(m.id);
      }
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const isBranchLocked = currentUser.role !== 'super_admin' && !canSwitchBranch();
  const allowedBranches = branches.filter((b) => {
    if (currentUser.role === 'super_admin' || currentUser.canSwitchBranches) return true;
    if (currentUser.allowedBranchIds && currentUser.allowedBranchIds.length > 0) {
      return currentUser.allowedBranchIds.includes(b.id);
    }
    return currentUser.branchId ? b.id === currentUser.branchId : true;
  });

  const canViewFinancials =
    currentUser.role === 'super_admin' ||
    currentUser.role === 'hub_manager' ||
    currentUser.role === 'cashier';

  return (
    <header className="sticky top-0 z-50 w-full h-11 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/60 flex items-center text-xs select-none shadow-sm">
      <div className="w-full max-w-[1780px] mx-auto px-3 sm:px-5 lg:px-7 flex items-center justify-between gap-2">
        {/* Right Side (in RTL): Traffic Lights + Orca Logo + Company Name + Compact Branch Selector */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* macOS Traffic Lights Simulation */}
          <div className="flex items-center gap-1.5 ml-0.5 sm:ml-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/90 border border-rose-600 shadow-inner inline-block" title="إغلاق" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90 border border-amber-600 shadow-inner inline-block" title="تصغير" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90 border border-emerald-600 shadow-inner inline-block" title="تكبير" />
          </div>

          {/* Company Brand Logo & Name */}
          <div
            onClick={() => setActiveModule('dashboard')}
            className="flex items-center gap-1.5 cursor-pointer px-1 py-0.5 rounded-lg hover:bg-slate-800/60 transition-colors font-bold text-slate-100 whitespace-nowrap group"
            title="العودة للوحة الرئيسية"
          >
            <OrcaLogo size={24} className="group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
              {brandingSettings.companyName || 'أوركا اكسبريس'}
            </span>
          </div>

          {/* Branch Indicator (Fixed - Locked strictly to session and login) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-200 font-medium whitespace-nowrap text-[11px] shadow-xs select-none">
            {currentUser.role === 'super_admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : isBranchLocked ? (
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            ) : (
              <Building2 className="w-3 h-3 text-cyan-400 shrink-0" />
            )}
            {currentUser.role === 'super_admin' ? (
              <div className="flex items-center gap-1">
                <span className="text-amber-300 font-bold hidden sm:inline">مسؤول التطبيق:</span>
                <span className="max-w-[85px] sm:max-w-[125px] truncate text-slate-200">{currentBranch.name}</span>
              </div>
            ) : (
              <span className="max-w-[85px] sm:max-w-[125px] truncate">{currentBranch.name}</span>
            )}
            <span
              className={`text-[9px] px-1 py-0.2 rounded hidden sm:inline font-bold ${
                currentBranch.type === 'main_hub'
                  ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                  : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
              }`}
            >
              {currentBranch.type === 'main_hub' ? 'مركز' : 'تجميع'}
            </span>
          </div>

          {/* Network Latency Indicator right next to branch name */}
          <NetworkLatencyIndicator />
        </div>

        {/* Middle: Compact Global Quick Search Trigger */}
        <div className="flex-1 max-w-xs sm:max-w-sm mx-1 sm:mx-2">
          <button
            type="button"
            id="global-spotlight-search-trigger"
            onClick={() => setIsSpotlightOpen(true)}
            className="w-full h-7 sm:h-8 px-2.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-700/80 hover:border-cyan-500/80 rounded-lg flex items-center justify-between text-slate-300 hover:text-white transition-all shadow-inner group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs truncate">
              <Search className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="text-slate-400 group-hover:text-slate-200 font-medium truncate text-[11px]">
                البحث السريع الموحد (⌘K)...
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <kbd className="hidden sm:inline-flex items-center text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded border border-slate-700 font-mono">
                ⌘K
              </kbd>
            </div>
          </button>
        </div>

        {/* Global Quick Search Spotlight Modal */}
        <QuickSearchSpotlightModal
          isOpen={isSpotlightOpen}
          onClose={() => setIsSpotlightOpen(false)}
        />

        {/* Left Side: Dual Balance, Clock, Notifications, User Menu, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Balances Mini Ticker - ONLY FOR SUPER ADMIN (الصندوق الموحد) */}
          {currentUser?.role === 'super_admin' && (
            <div className="hidden xl:flex items-center gap-2 bg-slate-950/80 border border-amber-500/30 px-2 py-0.5 rounded-md shadow-inner text-[10px]">
              <span className="text-amber-300 font-bold">الصندوق الموحد:</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono font-bold text-emerald-300">
                  {formatCurrency(branchesWithDerivedBalances.reduce((sum, b) => sum + (b.boxSypBalance || 0), 0), 'SYP')}
                </span>
              </div>
              <div className="w-[1px] h-2.5 bg-slate-700/60" />
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono font-bold text-cyan-300">
                  {formatCurrency(branchesWithDerivedBalances.reduce((sum, b) => sum + (b.boxUsdBalance || 0), 0), 'USD')}
                </span>
              </div>
            </div>
          )}

          {/* Unified Notifications & Directives Bell with Popovers */}
          <div className="relative">
            <button
              id="notifications-topbar-btn"
              onClick={() => {
                if (isChatPopoverOpen) {
                  setIsChatPopoverOpen(false);
                } else {
                  setIsNotifOpen(!isNotifOpen);
                }
              }}
              className={`p-1.5 rounded-lg border relative transition-all cursor-pointer flex items-center gap-1 ${
                hasUnreadCashierCollect
                  ? 'bg-rose-950/90 border-rose-500/90 text-rose-300 shadow-lg shadow-rose-600/50 ring-2 ring-rose-500/80 animate-pulse'
                  : isChatPopoverOpen || isNotifOpen
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border-slate-700/60'
              }`}
              title={
                hasUnreadCashierCollect
                  ? '🚨 إشعار عاجل لأمين الصندوق: يوجد طلب قبض قيمة طرد بانتظار الإيداع!'
                  : 'مركز الإشعارات والتوجيهات الإدارية'
              }
            >
              <Bell className={`w-3.5 h-3.5 ${hasUnreadCashierCollect ? 'text-rose-400 animate-bounce' : 'text-slate-300'}`} />
              {totalUnreadCount > 0 && (
                <span
                  className={`absolute -top-1.5 -right-1.5 text-white text-[9px] font-black font-mono min-w-[17px] h-4 px-1 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    hasUnreadCashierCollect
                      ? 'bg-rose-600 border-2 border-rose-200 shadow-rose-600/90 animate-bounce ring-2 ring-rose-500/80'
                      : 'bg-rose-500 shadow-md animate-bounce'
                  }`}
                >
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {/* Notifications Drawer (when chat popover is closed) */}
            {isNotifOpen && !isChatPopoverOpen && (
              <div
                className="absolute left-0 mt-1.5 w-[330px] sm:w-[410px] max-w-[calc(100vw-16px)] bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Header with Title and Chat Launcher */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 text-xs">الإشعارات والتوجيهات</span>
                    {totalUnreadCount > 0 && (
                      <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800 font-bold">
                        {totalUnreadCount} جديد
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatDirectiveId(accessibleDirectives[0]?.id || null);
                        setIsNotifOpen(false);
                        setIsChatPopoverOpen(true);
                      }}
                      className="text-[10px] bg-amber-600/90 hover:bg-amber-500 text-white px-2 py-0.5 rounded-md font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                      title="فتح إطار الدردشة المباشرة مع الإدارة"
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>فتح الدردشة</span>
                    </button>
                    {totalUnreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                      >
                        قراءة الكل
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 mb-2 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setNotifFilter('all')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer text-center ${
                      notifFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل ({isolatedNotifications.length + accessibleDirectives.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('directives')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                      notifFilter === 'directives'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-2.5 h-2.5" />
                    <span>التوجيهات ({accessibleDirectives.length})</span>
                    {unreadDirectivesCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter('system')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                      notifFilter === 'system'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>النظام ({isolatedNotifications.length})</span>
                    {unreadCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    )}
                  </button>
                </div>

                {/* Notifications & Directives List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {/* Directives Section (when filter is 'all' or 'directives') */}
                  {(notifFilter === 'all' || notifFilter === 'directives') &&
                    accessibleDirectives.length > 0 && (
                      <div className="space-y-1.5">
                        {notifFilter === 'all' && (
                          <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1 px-1 pt-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>التوجيهات الإدارية والمراسلات:</span>
                          </div>
                        )}
                        {accessibleDirectives.slice(0, notifFilter === 'all' ? 3 : 10).map((m) => {
                          const isUnread = !m.isRead && m.senderUserId !== currentUser.id;
                          return (
                            <div
                              key={`dir-${m.id}`}
                              onClick={() => {
                                markDirectMessageRead(m.id);
                                setActiveChatDirectiveId(m.id);
                                setIsNotifOpen(false);
                                setIsChatPopoverOpen(true);
                              }}
                              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isUnread
                                  ? 'bg-amber-950/40 border-amber-500/60 text-slate-100 shadow-sm'
                                  : 'bg-slate-800/50 border-slate-750 text-slate-300 hover:bg-slate-800/90'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-amber-300 flex items-center gap-1 truncate">
                                  <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
                                  {m.title}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[9px] font-bold px-1.5 rounded ${
                                      m.priority === 'urgent'
                                        ? 'bg-rose-500/20 text-rose-300'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {m.priority === 'urgent' ? 'عاجل' : 'توجيه'}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono" dir="ltr">
                                    {new Date(m.timestamp).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                                {m.content}
                              </p>
                              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-750/60 text-[10px] text-slate-400">
                                <span>من: {m.senderName}</span>
                                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                  فتح الدردشة والرد &larr;
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* System Notifications Section (when filter is 'all' or 'system') */}
                  {(notifFilter === 'all' || notifFilter === 'system') && (
                    <div className="space-y-1.5">
                      {notifFilter === 'all' && isolatedNotifications.length > 0 && (
                        <div className="text-[10px] font-bold text-cyan-400 flex items-center gap-1 px-1 pt-1">
                          <Bell className="w-3 h-3" />
                          <span>تنبيهات النظام والتشغيل:</span>
                        </div>
                      )}
                      {isolatedNotifications.length === 0 ? (
                        notifFilter === 'system' && (
                          <div className="text-center py-6 text-slate-500 text-xs">
                            لا توجد تنبيهات نظام حالياً
                          </div>
                        )
                      ) : (
                        isolatedNotifications.slice(0, notifFilter === 'all' ? 4 : 15).map((n) => (
                          <div
                            key={`notif-${n.id}`}
                            onClick={() => {
                              markNotificationRead(n.id);
                              if (n.isDirectMessage || n.type === 'admin_directive') {
                                setActiveChatDirectiveId(n.conversationId || n.id);
                                setIsNotifOpen(false);
                                setIsChatPopoverOpen(true);
                              } else if (n.actionType === 'cashier_collect' && n.relatedId) {
                                setIsNotifOpen(false);
                                openCashierCollectModal(n.relatedId, n.id);
                              } else if ((n.actionType === 'cod_payout_sender' || n.type === 'cod_payout_due') && n.relatedId) {
                                setIsNotifOpen(false);
                                openCodSenderPayoutModal(n.relatedId);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              !n.read
                                ? 'bg-cyan-950/30 border-cyan-500/40 text-slate-100'
                                : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-cyan-300 flex items-center gap-1">
                                {n.title}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {new Date(n.timestamp).toLocaleTimeString('ar-SY', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                              {n.message}
                            </p>

                            {/* Cashier Quick Action Box in TopBar */}
                            {n.actionType === 'cashier_collect' && n.parcelSummary && (
                              <div className="mt-2 p-2 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400">
                                    المستلم: <strong className="text-white">{n.parcelSummary.receiverName}</strong>
                                  </span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {n.parcelSummary.amountSummary}
                                  </span>
                                </div>
                                {!n.read ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markNotificationRead(n.id);
                                      setIsNotifOpen(false);
                                      if (n.relatedId) {
                                        openCashierCollectModal(n.relatedId, n.id);
                                      }
                                    }}
                                    className="w-full py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow cursor-pointer transition active:scale-95"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>قبض وإدخال المبلغ بالصندوق</span>
                                  </button>
                                ) : (
                                  <div className="text-[10px] text-emerald-400 font-bold text-center py-0.5">
                                    ✓ تم معالجة القبض أو إيداعه بصندوق الفرع
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {isolatedNotifications.length === 0 &&
                    accessibleDirectives.length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        لا توجد إشعارات أو توجيهات موجهة لك أو لفرعك حالياً
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Medium-Sized Directive Chat Popover Anchored Under the Notification Bell */}
            <DirectiveChatPopover
              isOpen={isChatPopoverOpen}
              onClose={() => setIsChatPopoverOpen(false)}
              initialDirectiveId={activeChatDirectiveId}
              onBackToNotifications={() => {
                setIsChatPopoverOpen(false);
                setIsNotifOpen(true);
              }}
            />
          </div>

          {/* Central Database Sync Badge (Prompt 68) */}
          {(() => {
            const connectionInfo = deriveConnectionState(
              cloudSyncState,
              typeof navigator !== 'undefined' ? navigator.onLine : true
            );
            return currentUser.role === 'super_admin' ? (
              // super_admin: قابل للنقر → يفتح شاشة النسخ الاحتياطي وإدارة المزامنة
              <button
                type="button"
                onClick={() => setActiveModule('backup_cloud')}
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all cursor-pointer ${
                  connectionInfo.color === 'emerald'
                    ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-500/40 text-emerald-300'
                    : connectionInfo.color === 'amber'
                    ? 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-500/40 text-amber-300'
                    : connectionInfo.color === 'orange'
                    ? 'bg-orange-950/60 hover:bg-orange-900/70 border-orange-500/40 text-orange-300'
                    : 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-500/40 text-rose-300'
                }`}
                title="فتح إدارة المزامنة والنسخ الاحتياطي لقاعدة البيانات"
              >
                <Server
                  className={`w-3 h-3 ${
                    connectionInfo.color === 'emerald'
                      ? 'text-emerald-400'
                      : connectionInfo.color === 'amber'
                      ? 'text-amber-400 animate-spin'
                      : connectionInfo.color === 'orange'
                      ? 'text-orange-400'
                      : 'text-rose-400'
                  }`}
                />
                <span className="truncate max-w-[140px]">
                  {connectionInfo.label}
                </span>
                {cloudSyncState?.pendingQueueCount > 0 ? (
                  <span className="px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-black">
                    +{cloudSyncState.pendingQueueCount}
                  </span>
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionInfo.color === 'emerald'
                        ? 'bg-emerald-400'
                        : connectionInfo.color === 'amber'
                        ? 'bg-amber-400 animate-ping'
                        : connectionInfo.color === 'orange'
                        ? 'bg-orange-400'
                        : 'bg-rose-500'
                    }`}
                  />
                )}
              </button>
            ) : (
              // غير super_admin: عرض فقط (غير قابل للنقر)
              <div
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold cursor-default select-none opacity-85 hover:opacity-100 transition-opacity ${
                  connectionInfo.color === 'emerald'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : connectionInfo.color === 'amber'
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    : connectionInfo.color === 'orange'
                    ? 'bg-orange-950/60 border-orange-500/40 text-orange-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
                title="حالة الاتصال (للقراءة فقط) — تواصل مع المدير للتفاصيل"
              >
                <Server
                  className={`w-3 h-3 ${
                    connectionInfo.color === 'emerald'
                      ? 'text-emerald-400'
                      : connectionInfo.color === 'amber'
                      ? 'text-amber-400 animate-spin'
                      : connectionInfo.color === 'orange'
                      ? 'text-orange-400'
                      : 'text-rose-400'
                  }`}
                />
                <span className="truncate max-w-[140px]">
                  {connectionInfo.label}
                </span>
                {cloudSyncState?.pendingQueueCount > 0 ? (
                  <span className="px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] font-black">
                    +{cloudSyncState.pendingQueueCount}
                  </span>
                ) : (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionInfo.color === 'emerald'
                        ? 'bg-emerald-400'
                        : connectionInfo.color === 'amber'
                        ? 'bg-amber-400 animate-ping'
                        : connectionInfo.color === 'orange'
                        ? 'bg-orange-400'
                        : 'bg-rose-500'
                    }`}
                  />
                )}
              </div>
            );
          })()}

          {/* Fullscreen Toggle on the right of the clock */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 hidden sm:flex items-center justify-center transition-colors cursor-pointer"
            title={isFullscreen ? 'إنهاء التوسيع' : 'توسيع'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Live Damascus Time Clock */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/50 border border-slate-800/70 text-slate-300 font-mono text-[10px]">
            <Clock className="w-3 h-3 text-cyan-400/80" />
            <span className="text-slate-400">{currentDate}</span>
            <span className="text-cyan-300 font-bold">{currentTime}</span>
          </div>

          {/* User Account Menu */}
          <div className="relative">
            <button
              id="user-account-btn"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 text-slate-200 transition-all cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <span className="font-semibold text-[11px] max-w-[75px] sm:max-w-[100px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div
                className="absolute left-0 mt-1.5 w-64 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs text-slate-200"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-100">{currentUser.name}</div>
                    <div className="text-[10px] text-cyan-400 font-mono">@{currentUser.username}</div>
                  </div>
                </div>

                <div className="py-1">
                  <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold">الدور والصلاحية:</div>
                  <div className="px-2 py-1 bg-slate-800/60 rounded-lg mx-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">
                      {currentUser.role === 'super_admin'
                        ? 'المدير العام (Super Admin)'
                        : currentUser.role === 'hub_manager'
                        ? 'مدير المركز الرئيسي'
                        : currentUser.role === 'reception_data_entry'
                        ? 'موظف الاستقبال والمدخل'
                        : currentUser.role === 'warehouse_keeper'
                        ? 'أمين المستودع'
                        : currentUser.role === 'cashier'
                        ? 'أمين الصندوق'
                        : 'سائق / مندوب توزيع'}
                    </span>
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                </div>

                <div className="border-t border-slate-800 mt-1 pt-1 space-y-0.5">
                  {currentUser.role === 'super_admin' && (
                    <button
                      onClick={() => {
                        setActiveModule('master_admin');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>لوحة الإدارة المركزية</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                        سيادي
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setActiveModule('backup_cloud');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>النسخ الاحتياطي واستعادة البيانات</span>
                  </button>
                </div>

                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-rose-900/30 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>تسجيل الخروج من النظام</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Quick Search Spotlight Modal (Cmd+K / Ctrl+K) */}
      <QuickSearchSpotlightModal
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
      />

      {/* Administrative Directives & Isolated Messaging Center Modal */}
      <AdminDirectivesModal
        isOpen={isDirectivesModalOpen}
        onClose={() => {
          setIsDirectivesModalOpen(false);
          setSelectedDirectiveId(undefined);
        }}
        initialDirectiveId={selectedDirectiveId}
      />
    </header>
  );
};
