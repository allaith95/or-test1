import React, { useState, useEffect, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import { DirectMessage } from '../types';
import { isDirectiveAccessibleToUser } from '../utils/permissionEngine';
import {
  Send,
  MessageSquare,
  Building2,
  User,
  Clock,
  CheckCheck,
  Check,
  X,
  ArrowRight,
  Plus,
  Inbox,
  AlertCircle,
  Bell,
  CheckCircle2,
  Search,
} from 'lucide-react';

interface DirectiveChatPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  initialDirectiveId?: string | null;
  onBackToNotifications?: () => void;
}

export const DirectiveChatPopover: React.FC<DirectiveChatPopoverProps> = ({
  isOpen,
  onClose,
  initialDirectiveId,
  onBackToNotifications,
}) => {
  const {
    currentUser,
    currentBranch,
    users,
    branches,
    directMessages,
    sendDirectMessage,
    markDirectMessageRead,
    hasPermission,
  } = useOrca();

  const canSendDirectives =
    hasPermission('directives.send') ||
    currentUser.role === 'super_admin' ||
    currentUser.role === 'hub_manager';

  const [activeTab, setActiveTab] = useState<'chat' | 'threads' | 'new'>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialDirectiveId || null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [acknowledgedSuccess, setAcknowledgedSuccess] = useState(false);

  // New Directive Form State
  const [recipientType, setRecipientType] = useState<'user' | 'branch'>('user');
  const [recipientUserId, setRecipientUserId] = useState<string>(
    users.find((u) => u.id !== currentUser.id)?.id || ''
  );
  const [recipientBranchId, setRecipientBranchId] = useState<string>(currentBranch.id);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('important');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync initialDirectiveId when passed
  useEffect(() => {
    if (initialDirectiveId) {
      setActiveConversationId(initialDirectiveId);
      setActiveTab('chat');
      markDirectMessageRead(initialDirectiveId);
    }
  }, [initialDirectiveId]);

  // Messages accessible to current user strictly between sender and recipient
  const accessibleMessages = directMessages.filter((msg) => {
    return isDirectiveAccessibleToUser(msg, currentUser, currentBranch.id);
  });

  // Pick default conversation if none selected
  useEffect(() => {
    if (!activeConversationId && accessibleMessages.length > 0) {
      setActiveConversationId(accessibleMessages[0].id);
    }
  }, [accessibleMessages, activeConversationId]);

  // Find root directive / message for active conversation
  const activeMessage = accessibleMessages.find(
    (m) => m.id === activeConversationId || m.replyToId === activeConversationId
  ) || accessibleMessages[0] || null;

  // Find all messages in this conversation thread
  const threadMessages = accessibleMessages
    .filter((m) => {
      if (!activeMessage) return false;
      const rootId = activeMessage.replyToId || activeMessage.id;
      return m.id === rootId || m.replyToId === rootId;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Mark active messages as read
  useEffect(() => {
    if (activeMessage && !activeMessage.isRead && activeMessage.senderUserId !== currentUser.id) {
      markDirectMessageRead(activeMessage.id);
    }
  }, [activeMessage, currentUser.id]);

  // Scroll to bottom when conversation changes or messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, activeTab]);

  if (!isOpen) return null;

  const handleSendReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !activeMessage) return;

    const isSender = activeMessage.senderUserId === currentUser.id;
    const targetUserId = isSender ? activeMessage.recipientUserId : activeMessage.senderUserId;
    const targetUserName = isSender ? activeMessage.recipientUserName : activeMessage.senderName;

    sendDirectMessage({
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientType: activeMessage.recipientType === 'branch' ? 'branch' : 'user',
      recipientUserId: activeMessage.recipientType === 'user' ? targetUserId : undefined,
      recipientUserName: activeMessage.recipientType === 'user' ? targetUserName : undefined,
      recipientBranchId: activeMessage.recipientType === 'branch' ? activeMessage.recipientBranchId : undefined,
      recipientBranchName: activeMessage.recipientType === 'branch' ? activeMessage.recipientBranchName : undefined,
      title: `رد: ${activeMessage.title}`,
      content: replyText.trim(),
      priority: activeMessage.priority,
      replyToId: activeMessage.replyToId || activeMessage.id,
    });

    setReplyText('');
  };

  const handleQuickAcknowledge = () => {
    if (!activeMessage) return;
    const isSender = activeMessage.senderUserId === currentUser.id;
    const targetUserId = isSender ? activeMessage.recipientUserId : activeMessage.senderUserId;
    const targetUserName = isSender ? activeMessage.recipientUserName : activeMessage.senderName;

    sendDirectMessage({
      senderUserId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientType: activeMessage.recipientType === 'branch' ? 'branch' : 'user',
      recipientUserId: activeMessage.recipientType === 'user' ? targetUserId : undefined,
      recipientUserName: activeMessage.recipientType === 'user' ? targetUserName : undefined,
      recipientBranchId: activeMessage.recipientType === 'branch' ? activeMessage.recipientBranchId : undefined,
      recipientBranchName: activeMessage.recipientType === 'branch' ? activeMessage.recipientBranchName : undefined,
      title: `إشعار استلام: ${activeMessage.title}`,
      content: `تم تأكيد الاطلاع والاستلام والعمل بموجبه رسمياً من قبل [${currentUser.name} - ${currentBranch.name}].`,
      priority: 'normal',
      replyToId: activeMessage.replyToId || activeMessage.id,
    });

    setAcknowledgedSuccess(true);
    setTimeout(() => setAcknowledgedSuccess(false), 3000);
  };

  const handleCreateNew = (e: React.FormEvent) => {
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
      title: title.trim() || 'توجيه إداري رسمي',
      content: content.trim(),
      priority,
    });

    setTitle('');
    setContent('');
    setActiveConversationId(newMsg.id);
    setActiveTab('chat');
  };

  // Group threads
  const threadMap = new Map<string, DirectMessage>();
  accessibleMessages.forEach((m) => {
    const rootId = m.replyToId || m.id;
    if (!threadMap.has(rootId)) {
      threadMap.set(rootId, m);
    }
  });
  const allThreads = Array.from(threadMap.values());
  const filteredThreads = allThreads.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.senderName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      id="directive-chat-popover"
      className="absolute left-0 mt-1.5 w-[92vw] sm:w-[480px] md:w-[520px] max-w-[calc(100vw-16px)] h-[520px] max-h-[82vh] bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header with Navigation & Tabs */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-850 border-b border-slate-750 shrink-0">
        <div className="flex items-center gap-2">
          {onBackToNotifications && (
            <button
              type="button"
              onClick={onBackToNotifications}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-750 transition cursor-pointer"
              title="العودة لمركز الإشعارات"
            >
              <ArrowRight className="w-4 h-4 text-cyan-400" />
            </button>
          )}

          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>

          <span className="text-xs font-bold text-white">الدردشة والتوجيهات الإدارية</span>
        </div>

        {/* Tab Switchers inside Header */}
        <div className="flex items-center gap-1">
          <div className="bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              المحادثة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('threads')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'threads'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Inbox className="w-2.5 h-2.5" />
              <span>السجل ({allThreads.length})</span>
            </button>
            {canSendDirectives && (
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-0.5 ${
                  activeTab === 'new'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>جديد</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="إغلاق الدردشة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab 1: Active Chat View */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60">
          {activeMessage ? (
            <>
              {/* Partner Banner & Subject */}
              <div className="px-3 py-2 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
                    {activeMessage.recipientType === 'branch' ? (
                      <Building2 className="w-3 h-3" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {activeMessage.senderUserId === currentUser.id
                          ? activeMessage.recipientType === 'user'
                            ? activeMessage.recipientUserName
                            : activeMessage.recipientBranchName
                          : activeMessage.senderName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          activeMessage.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : activeMessage.priority === 'important'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        }`}
                      >
                        {activeMessage.priority === 'urgent'
                          ? 'عاجل جداً'
                          : activeMessage.priority === 'important'
                          ? 'مهم'
                          : 'عادي'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.2">
                      موضوع التوجيه: {activeMessage.title}
                    </p>
                  </div>
                </div>

                {/* Quick Acknowledge Button */}
                {activeMessage.senderUserId !== currentUser.id && (
                  <button
                    type="button"
                    onClick={handleQuickAcknowledge}
                    className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                    title="إرسال إشعار فوري بتأكيد الاستلام والعمل بالموجب"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>تأكيد الاستلام</span>
                  </button>
                )}
              </div>

              {acknowledgedSuccess && (
                <div className="bg-emerald-950/90 text-emerald-200 text-xs px-3 py-1.5 flex items-center gap-1.5 border-b border-emerald-800 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم إرسال تأكيد استلام التوجيه بنجاح للطرف الآخر.</span>
                </div>
              )}

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                {threadMessages.map((msg) => {
                  const isMe = msg.senderUserId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-[10px] font-bold text-slate-300">
                          {isMe ? 'أنت' : msg.senderName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString('ar-SY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-50 rounded-tl-sm'
                            : 'bg-slate-800/90 border border-slate-700 text-slate-100 rounded-tr-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                          {isMe && (
                            <span className="flex items-center gap-0.5 text-cyan-400">
                              {msg.isRead ? (
                                <CheckCheck className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input Bar */}
              <form
                onSubmit={handleSendReply}
                className="p-2 bg-slate-850/90 border-t border-slate-800 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب رداً رسمياً على التوجيه..."
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs">لا توجد محادثة نشطة حالياً</p>
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className="mt-3 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                تحرير توجيه جديد
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Threads & Conversations */}
      {activeTab === 'threads' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60 p-3">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في التوجيهات والمراسلات..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                لا توجد توجيهات تطابق البحث
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = (thread.replyToId || thread.id) === (activeMessage?.replyToId || activeMessage?.id);
                return (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setActiveConversationId(thread.replyToId || thread.id);
                      setActiveTab('chat');
                    }}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/50 text-white'
                        : 'bg-slate-800/50 border-slate-800 hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-amber-300 truncate max-w-[240px]">
                        {thread.title}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {new Date(thread.timestamp).toLocaleDateString('ar-SY', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-1">{thread.content}</p>

                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-700/50 text-[10px] text-slate-400">
                      <span>من: {thread.senderName}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 rounded ${
                          thread.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {thread.priority === 'urgent' ? 'عاجل' : 'توجيه'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Compose New Directive */}
      {activeTab === 'new' && (
        <form onSubmit={handleCreateNew} className="flex-1 flex flex-col p-3.5 space-y-3 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">نوع المستلم:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecipientType('user')}
                className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  recipientType === 'user'
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                مستخدم محدد
              </button>
              <button
                type="button"
                onClick={() => setRecipientType('branch')}
                className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  recipientType === 'branch'
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                فرع بالكامل
              </button>
            </div>
          </div>

          {recipientType === 'user' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">المستخدم المستهدف:</label>
              <select
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">الفرع المستهدف:</label>
              <select
                value={recipientBranchId}
                onChange={(e) => setRecipientBranchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.governorate})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">عنوان التوجيه:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: مطابقة صناديق المساء"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">درجة الأهمية:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="normal">عادي</option>
                <option value="important">مهم</option>
                <option value="urgent">عاجل جداً</option>
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-[11px] font-bold text-slate-300 mb-1">نص القرار / التوجيه الملزم:</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب التوجيه الإداري بدقة ووضوح..."
              rows={4}
              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!content.trim()}
            className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>إرسال وتعميم التوجيه</span>
          </button>
        </form>
      )}
    </div>
  );
};
