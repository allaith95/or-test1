import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { safePrint } from '../utils/storage';
import { DirectMessage } from '../types';
import { isDirectiveAccessibleToUser } from '../utils/permissionEngine';
import {
  Send,
  MessageSquare,
  ShieldAlert,
  Building2,
  User,
  Clock,
  CheckCheck,
  Check,
  Trash2,
  Reply,
  Search,
  X,
  AlertCircle,
  Inbox,
  SendHorizontal,
  Printer,
  FileText,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface AdminDirectivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipientUserId?: string;
  defaultRecipientBranchId?: string;
  initialDirectiveId?: string;
  initialTab?: 'threads' | 'new_directive' | 'view_directive';
}

export const AdminDirectivesModal: React.FC<AdminDirectivesModalProps> = ({
  isOpen,
  onClose,
  defaultRecipientUserId,
  defaultRecipientBranchId,
  initialDirectiveId,
  initialTab = 'threads',
}) => {
  const {
    currentUser,
    currentBranch,
    users,
    branches,
    directMessages,
    sendDirectMessage,
    markDirectMessageRead,
    deleteDirectMessage,
    brandingSettings,
    hasPermission,
  } = useOrca();

  const canSendDirectives =
    hasPermission('directives.send') ||
    currentUser.role === 'super_admin' ||
    currentUser.role === 'hub_manager';

  const [activeTab, setActiveTab] = useState<'threads' | 'new_directive' | 'view_directive'>(
    initialDirectiveId ? 'view_directive' : initialTab
  );
  const [selectedThreadPartnerId, setSelectedThreadPartnerId] = useState<string | null>(
    defaultRecipientUserId || null
  );
  const [selectedDirective, setSelectedDirective] = useState<DirectMessage | null>(null);

  // New Message State
  const [recipientType, setRecipientType] = useState<'user' | 'branch'>(
    defaultRecipientBranchId ? 'branch' : 'user'
  );
  const [recipientUserId, setRecipientUserId] = useState<string>(
    defaultRecipientUserId || (users.find((u) => u.id !== currentUser.id)?.id || '')
  );
  const [recipientBranchId, setRecipientBranchId] = useState<string>(
    defaultRecipientBranchId || currentBranch.id
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('important');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [acknowledgedSuccess, setAcknowledgedSuccess] = useState(false);

  // Sync initial directive when passed
  useEffect(() => {
    if (initialDirectiveId) {
      const found = directMessages.find(
        (m) => m.id === initialDirectiveId || m.replyToId === initialDirectiveId
      );
      if (found) {
        setSelectedDirective(found);
        setActiveTab('view_directive');
        markDirectMessageRead(found.id);
      }
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialDirectiveId, initialTab, directMessages]);

  if (!isOpen) return null;

  // Filter messages accessible to this user strictly restricted to sender and recipient route
  const userMessages = directMessages.filter((msg) => {
    return isDirectiveAccessibleToUser(msg, currentUser, currentBranch.id);
  });

  // Filter by search query
  const filteredMessages = userMessages.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.recipientUserName && m.recipientUserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.recipientBranchName && m.recipientBranchName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group messages into distinct partners/channels for thread navigation
  const threadPartnersMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: 'user' | 'branch';
      subtitle: string;
      lastMessage: DirectMessage;
      unreadCount: number;
    }
  >();

  userMessages.forEach((msg) => {
    let partnerKey = '';
    let partnerName = '';
    let partnerType: 'user' | 'branch' = 'user';
    let partnerSub = '';

    if (msg.recipientType === 'branch' && msg.recipientBranchId) {
      partnerKey = `branch_${msg.recipientBranchId}`;
      partnerName = msg.recipientBranchName || 'فرع الشركة';
      partnerType = 'branch';
      partnerSub = 'قناة توجيهات الفرع كاملة';
    } else {
      const isSender = msg.senderUserId === currentUser.id;
      const otherUserId = isSender ? msg.recipientUserId : msg.senderUserId;
      partnerKey = `user_${otherUserId || 'unknown'}`;
      partnerName = isSender
        ? msg.recipientUserName || 'مستخدم'
        : msg.senderName;
      partnerType = 'user';
      partnerSub = isSender ? 'مستلم التوجيه' : 'مرسل التوجيه';
    }

    const existing = threadPartnersMap.get(partnerKey);
    const isUnreadForMe =
      !msg.isRead &&
      ((msg.recipientType === 'user' && msg.recipientUserId === currentUser.id) ||
        (msg.recipientType === 'branch' && msg.recipientBranchId === currentBranch.id));

    if (!existing || new Date(msg.timestamp) > new Date(existing.lastMessage.timestamp)) {
      threadPartnersMap.set(partnerKey, {
        id: partnerKey,
        name: partnerName,
        type: partnerType,
        subtitle: partnerSub,
        lastMessage: msg,
        unreadCount: (existing?.unreadCount || 0) + (isUnreadForMe ? 1 : 0),
      });
    } else if (isUnreadForMe) {
      existing.unreadCount += 1;
    }
  });

  const threadList = Array.from(threadPartnersMap.values()).sort(
    (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
  );

  // Active selected thread
  const activeThread =
    selectedThreadPartnerId || (threadList.length > 0 ? threadList[0].id : null);

  const activeMessages = filteredMessages
    .filter((msg) => {
      if (!activeThread) return true;
      if (activeThread.startsWith('branch_')) {
        const branchId = activeThread.replace('branch_', '');
        return msg.recipientType === 'branch' && msg.recipientBranchId === branchId;
      }
      const userId = activeThread.replace('user_', '');
      return (
        (msg.senderUserId === userId && msg.recipientUserId === currentUser.id) ||
        (msg.senderUserId === currentUser.id && msg.recipientUserId === userId)
      );
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const handleSendNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    let targetUserName = '';
    let targetBranchName = '';

    if (recipientType === 'user') {
      const targetUser = users.find((u) => u.id === recipientUserId);
      targetUserName = targetUser?.name || 'مستخدم غير محدد';
    } else {
      const targetBranch = branches.find((b) => b.id === recipientBranchId);
      targetBranchName = targetBranch?.name || 'فرع غير محدد';
    }

    const newMsg = sendDirectMessage({
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientType,
      recipientUserId: recipientType === 'user' ? recipientUserId : undefined,
      recipientUserName: recipientType === 'user' ? targetUserName : undefined,
      recipientBranchId: recipientType === 'branch' ? recipientBranchId : undefined,
      recipientBranchName: recipientType === 'branch' ? targetBranchName : undefined,
      title: title.trim() || 'توجيه إداري مباشر ملزم',
      content: content.trim(),
      priority,
    });

    setTitle('');
    setContent('');
    setSelectedDirective(newMsg);
    setActiveTab('view_directive');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const baseMsg = selectedDirective || (activeMessages.length > 0 ? activeMessages[activeMessages.length - 1] : null);

    if (baseMsg) {
      const isSender = baseMsg.senderUserId === currentUser.id;
      const targetUserId = isSender ? baseMsg.recipientUserId : baseMsg.senderUserId;
      const targetUserName = isSender ? baseMsg.recipientUserName : baseMsg.senderName;

      const replyMsg = sendDirectMessage({
        senderUserId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        recipientType: baseMsg.recipientType === 'branch' ? 'branch' : 'user',
        recipientUserId: baseMsg.recipientType === 'user' ? targetUserId : undefined,
        recipientUserName: baseMsg.recipientType === 'user' ? targetUserName : undefined,
        recipientBranchId: baseMsg.recipientType === 'branch' ? baseMsg.recipientBranchId : undefined,
        recipientBranchName: baseMsg.recipientType === 'branch' ? baseMsg.recipientBranchName : undefined,
        title: `رد رسمي على: ${baseMsg.title}`,
        content: replyText.trim(),
        priority: 'normal',
        replyToId: baseMsg.id,
      });

      setReplyText('');
      setShowReplyForm(false);
      setSelectedDirective(replyMsg);
    }
  };

  const handleAcknowledge = (directiveId: string) => {
    markDirectMessageRead(directiveId);
    setAcknowledgedSuccess(true);
    setTimeout(() => setAcknowledgedSuccess(false), 3500);
  };

  const handlePrintDirective = () => {
    safePrint();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 pt-12 sm:pt-14 pb-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="admin-directives-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/95 w-full max-w-5xl h-[88vh] max-h-[850px] min-h-[540px] flex flex-col overflow-hidden text-slate-100 relative my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-800/95 border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  مركز التوجيهات الإدارية والمراسلات الرسمية
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {brandingSettings.companyName || 'أوركا إكسبريس'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                إرسال واستعراض الكتب والقرارات الإدارية الملزمة بين الإدارة التنفيذية والفروع
              </p>
            </div>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('threads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'threads'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>سجل التوجيهات</span>
            </button>

            {selectedDirective && (
              <button
                onClick={() => setActiveTab('view_directive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'view_directive'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>الكتاب الإداري المفتوح</span>
              </button>
            )}

            {canSendDirectives && (
              <button
                onClick={() => {
                  setActiveTab('new_directive');
                  setSelectedDirective(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'new_directive'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                <SendHorizontal className="w-3.5 h-3.5" />
                <span>تحرير توجيه جديد</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mr-1 cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Based on Active Tab */}
        {activeTab === 'view_directive' && selectedDirective ? (
          /* ========================================================= */
          /* 1. OFFICIAL DIRECTIVE MEMO VIEW (Identical to Manager Memo) */
          /* ========================================================= */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-900/80 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Back navigation & Quick Print bar */}
              <div className="flex items-center justify-between print:hidden">
                <button
                  onClick={() => setActiveTab('threads')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة لقائمة التوجيهات</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintDirective}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>طباعة الكتاب الإداري</span>
                  </button>
                </div>
              </div>

              {/* Official Directive Document Memo Card */}
              <div className="bg-slate-800/90 border border-amber-500/40 rounded-2xl p-5 sm:p-7 shadow-2xl shadow-black/80 relative overflow-hidden">
                {/* Decorative Watermark & Header Seal */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
                
                {/* Official Memorandum Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-700/80 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                          الجمهورية العربية السورية — شركة أوركا إكسبريس
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        كتاب وتوجيه إداري رسمي ملزم
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        الرقم المرجعي: DIR-2026-{selectedDirective.id.slice(-6)}
                      </span>
                    </div>
                  </div>

                  {/* Priority & Timestamp Badges */}
                  <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-1.5">
                    {selectedDirective.priority === 'urgent' && (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        درجة الأولوية: عاجل جداً وفوري
                      </span>
                    )}
                    {selectedDirective.priority === 'important' && (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        درجة الأولوية: هام ولازم
                      </span>
                    )}
                    {selectedDirective.priority === 'normal' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-300">
                        درجة الأولوية: عادي
                      </span>
                    )}

                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>
                        تاريخ الصدور:{' '}
                        {new Date(selectedDirective.timestamp).toLocaleString('ar-SY', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sender & Recipient Information Grid (Mirroring Composer Structure) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-900/70 border border-slate-700/60 rounded-xl mb-4">
                  {/* Sender Details */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الجهة المصدرة للتوجيه:</span>
                      <strong className="text-xs font-bold text-white block">
                        {selectedDirective.senderName}
                      </strong>
                      <span className="text-[11px] text-amber-400/90 font-medium">
                        {selectedDirective.senderRole === 'super_admin'
                          ? 'المدير التنفيذي العام (الإدارة المركزية)'
                          : selectedDirective.senderRole === 'hub_manager'
                          ? 'مدير فرع رئيسي'
                          : selectedDirective.senderRole}
                      </span>
                    </div>
                  </div>

                  {/* Recipient Details */}
                  <div className="flex items-start gap-2.5 sm:border-r sm:border-slate-700 sm:pr-3.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                      {selectedDirective.recipientType === 'branch' ? (
                        <Building2 className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الجهة المكلفة والمستهدفة:</span>
                      <strong className="text-xs font-bold text-cyan-300 block">
                        {selectedDirective.recipientType === 'branch'
                          ? selectedDirective.recipientBranchName || 'كافة فروع ومستودعات الشركة'
                          : selectedDirective.recipientUserName || 'الموظف المعني'}
                      </strong>
                      <span className="text-[11px] text-slate-400">
                        {selectedDirective.recipientType === 'branch'
                          ? 'توجيه إداري عام وشامل للفرع'
                          : 'مراسلة خاصة معزولة ومشفرة'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Directive Title Box */}
                <div className="mb-4">
                  <div className="text-[11px] font-bold text-amber-400/90 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>موضوع التوجيه والقرار الإداري:</span>
                  </div>
                  <div className="p-3 bg-slate-900 border-r-4 border-amber-400 border-y border-l border-slate-700/80 rounded-lg text-sm font-black text-white">
                    {selectedDirective.title || 'توجيه إداري مباشر'}
                  </div>
                </div>

                {/* Directive Full Content Body */}
                <div className="mb-5">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                    نص التعليمات والتوجيه الإداري الصادر:
                  </div>
                  <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans shadow-inner">
                    {selectedDirective.content}
                  </div>
                </div>

                {/* Directive Status & Execution Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-700/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">حالة الاستلام:</span>
                    {selectedDirective.isRead ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-800">
                        <CheckCheck className="w-3.5 h-3.5" />
                        تم الاطلاع والإقرار بالاستلام
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-800">
                        <Clock className="w-3.5 h-3.5" />
                        قيد انتظار المتابعة والإقرار
                      </span>
                    )}
                  </div>

                  {/* Immediate Action Buttons */}
                  <div className="flex items-center gap-2">
                    {!selectedDirective.isRead && (
                      <button
                        onClick={() => handleAcknowledge(selectedDirective.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>إقرار بالتنفيذ وتأكيد الاستلام</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowReplyForm(!showReplyForm)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
                    >
                      <Reply className="w-4 h-4" />
                      <span>كتابة رد رسمي</span>
                    </button>
                  </div>
                </div>

                {acknowledgedSuccess && (
                  <div className="mt-3 p-2.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs text-center font-bold animate-in fade-in duration-150 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تم تثبيت إقرارك بالتنفيذ وقراءة التوجيه في السجل الرسمي للمؤسسة</span>
                  </div>
                )}

                {/* Inline Official Reply Composer Form */}
                {showReplyForm && (
                  <form onSubmit={handleSendReply} className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        إرسال رد رسمي على هذا التوجيه:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowReplyForm(false)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        إلغاء
                      </button>
                    </div>

                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="اكتب ردك أو تقريرك الإداري بخصوص تنفيذ هذا التوجيه..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md shadow-cyan-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الرد الرسمي</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'new_directive' ? (
          /* ========================================================= */
          /* 2. COMPOSE NEW DIRECTIVE FORM                             */
          /* ========================================================= */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-900/60 custom-scrollbar">
            <form onSubmit={handleSendNew} className="max-w-2xl mx-auto space-y-4">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-400" />
                    <span>تحرير توجيه إداري أو رسالة خاصة جديدة</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    المرسل: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})
                  </span>
                </div>

                {/* Recipient Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    نوع المستلم والجهة المعنية:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRecipientType('user')}
                      className={`p-3 rounded-xl border text-right flex items-center gap-3 transition-all cursor-pointer ${
                        recipientType === 'user'
                          ? 'border-cyan-500 bg-cyan-950/50 text-cyan-200 shadow-md shadow-cyan-950/50'
                          : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <User className={`w-5 h-5 ${recipientType === 'user' ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs font-bold">مستخدم أو موظف بعينه</div>
                        <div className="text-[10px] opacity-75">رسالة خاصة معزولة تظهر للمستخدم المستهدف فقط</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecipientType('branch')}
                      className={`p-3 rounded-xl border text-right flex items-center gap-3 transition-all cursor-pointer ${
                        recipientType === 'branch'
                          ? 'border-amber-500 bg-amber-950/50 text-amber-200 shadow-md shadow-amber-950/50'
                          : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Building2 className={`w-5 h-5 ${recipientType === 'branch' ? 'text-amber-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs font-bold">فرع أو مركز كامل</div>
                        <div className="text-[10px] opacity-75">توجيه إداري لجميع موظفي ومدير الفرع المحدد</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Specific Recipient Dropdown */}
                {recipientType === 'user' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      اختر الموظف / المستخدم المستلم:
                    </label>
                    <select
                      value={recipientUserId}
                      onChange={(e) => setRecipientUserId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — ({u.role}) — {branches.find((b) => b.id === u.branchId)?.name || u.branchId}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      اختر الفرع أو المركز المستلم (كافة المحافظات الـ 14):
                    </label>
                    <select
                      value={recipientBranchId}
                      onChange={(e) => setRecipientBranchId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.governorate}) — {b.type === 'main_hub' ? 'رئيسي' : 'فرعي'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Priority Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    درجة الأولوية والأهمية:
                  </label>
                  <div className="flex items-center gap-3">
                    <label
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        priority === 'normal'
                          ? 'border-slate-500 bg-slate-700 text-white font-bold'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value="normal"
                        checked={priority === 'normal'}
                        onChange={() => setPriority('normal')}
                        className="hidden"
                      />
                      <span>عادي</span>
                    </label>

                    <label
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        priority === 'important'
                          ? 'border-amber-500 bg-amber-950/60 text-amber-300 font-bold shadow-md shadow-amber-950/50'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value="important"
                        checked={priority === 'important'}
                        onChange={() => setPriority('important')}
                        className="hidden"
                      />
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>هام ولازم</span>
                    </label>

                    <label
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        priority === 'urgent'
                          ? 'border-rose-500 bg-rose-950/60 text-rose-300 font-bold shadow-md shadow-rose-950/50 animate-pulse'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value="urgent"
                        checked={priority === 'urgent'}
                        onChange={() => setPriority('urgent')}
                        className="hidden"
                      />
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>عاجل جداً وفوري</span>
                    </label>
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    موضوع التوجيه / عنوان الرسالة:
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: تعليمات استلام الطرود الثقيلة وإجراءات الجرد اليومي..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Content Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نص التوجيه والتعليمات الإدارية الصادرة:
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب التوجيهات الرسمية بدقة ووضوح..."
                    rows={6}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setActiveTab('threads')}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!content.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <SendHorizontal className="w-4 h-4" />
                    <span>اعتماد وإرسال التوجيه الإداري</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* ========================================================= */
          /* 3. THREADS AND MESSAGES OVERVIEW LIST                     */
          /* ========================================================= */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900/40">
            {/* Thread Partners Sidebar */}
            <div className="w-full md:w-80 bg-slate-950/60 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في التوجيهات والرسائل..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                {threadList.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs px-4">
                    لا توجد مراسلات أو توجيهات سابقة
                  </div>
                ) : (
                  threadList.map((thread) => {
                    const isSelected = activeThread === thread.id;
                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThreadPartnerId(thread.id)}
                        className={`w-full text-right p-3 transition-colors flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/40 border-r-4 border-cyan-400'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            thread.type === 'branch'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {thread.type === 'branch' ? (
                            <Building2 className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate">
                              {thread.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(thread.lastMessage.timestamp).toLocaleDateString('ar-SY', {
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {thread.lastMessage.title || thread.lastMessage.content}
                          </p>

                          <div className="flex items-center justify-between mt-1 text-[10px]">
                            <span className="text-slate-500">{thread.subtitle}</span>
                            {thread.unreadCount > 0 && (
                              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full font-bold">
                                {thread.unreadCount} جديد
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Messages Feed in Selected Thread */}
            <div className="flex-1 flex flex-col bg-slate-900/40 overflow-hidden">
              {activeThread ? (
                <>
                  {/* Thread Header */}
                  <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                        {activeThread.startsWith('branch_') ? (
                          <Building2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <User className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {threadList.find((t) => t.id === activeThread)?.name || 'محادثة وتوجيهات'}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          سجل التوجيهات والقرارات الإدارية المشتركة
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>قناة رسمية مشفرة</span>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    {activeMessages.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        لا توجد رسائل سابقة في هذا السجل
                      </div>
                    ) : (
                      activeMessages.map((msg) => {
                        const isMe = msg.senderUserId === currentUser.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-xl rounded-2xl p-4 shadow-lg transition-all ${
                                isMe
                                  ? 'bg-gradient-to-br from-cyan-950/70 to-slate-850 text-slate-100 border border-cyan-700/50 rounded-br-none'
                                  : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 mb-2 text-xs">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span>{msg.senderName}</span>
                                  <span className="text-[10px] opacity-75 font-normal">
                                    ({msg.senderRole})
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {msg.priority === 'urgent' && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                                      <ShieldAlert className="w-3 h-3" />
                                      عاجل جداً
                                    </span>
                                  )}
                                  {msg.priority === 'important' && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                                      هام
                                    </span>
                                  )}
                                  <span className="text-[10px] opacity-60">
                                    {new Date(msg.timestamp).toLocaleString('ar-SY', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>

                              {msg.title && (
                                <h5 className="text-xs font-bold text-amber-300 mb-1.5 flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-amber-400" />
                                  <span>{msg.title}</span>
                                </h5>
                              )}

                              <p className="text-xs leading-relaxed whitespace-pre-wrap">
                                {msg.content}
                              </p>

                              <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-white/10 text-[10px]">
                                <button
                                  onClick={() => {
                                    setSelectedDirective(msg);
                                    setActiveTab('view_directive');
                                    markDirectMessageRead(msg.id);
                                  }}
                                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>عرض ككتاب إداري رسمي</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  {isMe && (
                                    <span className="flex items-center gap-0.5">
                                      {msg.isRead ? (
                                        <>
                                          <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                                          <span className="text-cyan-400">مقروء ومستلم</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-slate-400" />
                                          <span>تم التسليم</span>
                                        </>
                                      )}
                                    </span>
                                  )}

                                  {!isMe && !msg.isRead && (
                                    <button
                                      onClick={() => markDirectMessageRead(msg.id)}
                                      className="text-emerald-400 hover:underline font-bold"
                                    >
                                      تعليم كمقروء
                                    </button>
                                  )}

                                  {(isMe || currentUser.role === 'super_admin') && (
                                    <button
                                      onClick={() => deleteDirectMessage(msg.id)}
                                      className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                                      title="حذف الرسالة"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Reply Bar */}
                  <div className="p-3 bg-slate-950/60 border-t border-slate-800">
                    <form onSubmit={handleSendReply} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="اكتب رداً أو متابعة إدارية سريعة هنا..."
                        className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال</span>
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                  اختر محادثة من القائمة الجانبية أو اضغط "تحرير توجيه جديد"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
