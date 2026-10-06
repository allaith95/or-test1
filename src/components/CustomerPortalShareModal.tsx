import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Share2,
  Copy,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  X,
  QrCode,
  Globe,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerPortalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewPortal?: () => void;
}

export const CustomerPortalShareModal: React.FC<CustomerPortalShareModalProps> = ({
  isOpen,
  onClose,
  onPreviewPortal,
}) => {
  const { brandingSettings } = useOrca();
  const [copied, setCopied] = useState(false);

  // Generate the clean isolated customer URL with official CST-SC suffix
  const getCustomerPortalUrl = () => {
    try {
      const origin = window.location.origin;
      return `${origin}/?portal=CST-SC`;
    } catch {
      return 'https://ais-dev-lfdsp7px3lb7lfa7nujw6a-859452489279.europe-west2.run.app/?portal=CST-SC';
    }
  };

  const portalUrl = getCustomerPortalUrl();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const [copiedMessage, setCopiedMessage] = useState(false);

  const fullInviteMessage = `📦 مرحباً بكم! يمكنكم الآن متابعة طرودكم وكشوفات حساب حوالات الـ COD مباشرة عبر بوابة الزبائن المعزولة لشركة ${brandingSettings.companyName || 'أوركا إكسبريس'}:

🔗 الرابط المباشر للبوابة:
${portalUrl}

📲 طريقة تثبيت التطبيق على جوالك:
1. افتح الرابط أعلاه من متصفح هاتف المحمول.
2. انقر على زر "تثبيت التطبيق" المتاح أعلى الشاشة.
3. سيتم إضافة تطبيق "أوركا للزبائن" مباشرة على الشاشة الرئيسية لجوالك.

تسجيل الدخول برقم الهاتف المسجل ورمز PIN الخاص بحسابكم. شكراً لتعاملكم معنا!`;

  const handleCopyFullMessage = () => {
    navigator.clipboard.writeText(fullInviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullInviteMessage)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-right"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  رابط بوابة الزبائن المعزولة
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  رابط مخصص ومستقل تماماً يتم إرساله للعملاء والتجار
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feature highlights */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-indigo-300">
              <Globe className="w-4 h-4" />
              <span>ميزات عزل بوابة الزبائن:</span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>واجهة مخصصة لا تحتوي على أي إعدادات إدارية أو خيارات للموظفين.</li>
              <li>تسجيل دخول مباشر برقم هاتف العميل وكلمة المرور.</li>
              <li>إمكانية التتبع العام برقم البوليصة دون الحاجة لتسجيل الدخول.</li>
            </ul>
          </div>

          {/* Dedicated URL Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              الرابط المباشر للزبائن (Direct Portal URL):
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl p-2 pr-3">
              <span className="text-xs text-indigo-400 font-mono flex-1 truncate text-left" dir="ltr">
                {portalUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <MessageSquare className="w-4 h-4" />
              <span>مشاركة عبر واتساب (WhatsApp)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFullMessage}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              {copiedMessage ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تم نسخ الرسالة الكاملة!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-400" />
                  <span>نسخ رسالة التثبيت والدعوة</span>
                </>
              )}
            </button>
          </div>

          {/* Footer close */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
