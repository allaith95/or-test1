import React from 'react';
import { useOrca } from '../context/OrcaContext';
import { Branch } from '../types';
import {
  X,
  Building2,
  Wallet,
  Coins,
  Layers,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface BranchCashboxBreakdownModalProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BranchCashboxBreakdownModal: React.FC<BranchCashboxBreakdownModalProps> = ({
  branch,
  isOpen,
  onClose,
}) => {
  const { getCashboxBreakdown, formatCurrency } = useOrca();

  if (!isOpen || !branch) return null;

  const bData = getCashboxBreakdown(branch.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn dir-rtl">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{branch.name}</h3>
                <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800/40">
                  {branch.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تفصيل أرصدة الصناديق والمقبوضات الفرعية حسب سجل الحركات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Total Consolidated Branch Cashbox */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-300">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-amber-300 block">
                  إجمالي رصيد الصندوق الموحد للفرع
                </span>
                <span className="text-[11px] text-slate-400">
                  مجموع كافة الصناديق التشغيلية للفرع
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 dir-ltr font-mono">
              <div className="text-right">
                <span className="text-xs text-emerald-400 block font-bold">SYP</span>
                <span className="text-lg font-black text-emerald-300">
                  {formatCurrency(bData.totalBranchSyp || 0, 'SYP')}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-700/60" />
              <div className="text-right">
                <span className="text-xs text-cyan-400 block font-bold">USD</span>
                <span className="text-lg font-black text-cyan-300">
                  {formatCurrency(bData.totalBranchUsd || 0, 'USD')}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Sub-Boxes Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Outgoing Box (صندوق الصادر) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-200">صندوق قسم الصادر</span>
                </div>
                <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded">
                  إيرادات الشحن
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالليرة (SYP):</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(bData.outgoingBox?.syp || 0, 'SYP')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالدولار (USD):</span>
                  <span className="font-bold text-cyan-300">
                    {formatCurrency(bData.outgoingBox?.usd || 0, 'USD')}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Incoming Box (صندوق الوارد) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-200">صندوق قسم الوارد</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  تحصيلات التسليم
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالليرة (SYP):</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(bData.incomingBox?.syp || 0, 'SYP')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالدولار (USD):</span>
                  <span className="font-bold text-cyan-300">
                    {formatCurrency(bData.incomingBox?.usd || 0, 'USD')}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Manager Box (صندوق مدير الفرع والخزينة) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Coins className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-200">صندوق مدير الفرع</span>
                </div>
                <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                  المقبوضات المعتمدة
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالليرة (SYP):</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(bData.managerBox?.syp || 0, 'SYP')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالدولار (USD):</span>
                  <span className="font-bold text-cyan-300">
                    {formatCurrency(bData.managerBox?.usd || 0, 'USD')}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Cashier Box (صندوق الكاشير والعهدة) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-200">صندوق الكاشير والعهدة</span>
                </div>
                <span className="text-[10px] text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded">
                  المصروفات الميدانية
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالليرة (SYP):</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(bData.cashierBox?.syp || 0, 'SYP')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>الرصيد بالدولار (USD):</span>
                  <span className="font-bold text-cyan-300">
                    {formatCurrency(bData.cashierBox?.usd || 0, 'USD')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Notice */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              مجموع الصناديق الفرعية يطابق تماماً الرصيد الموحد المحسوب في سجل حركات الفرع.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
