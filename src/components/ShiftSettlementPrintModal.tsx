import React from 'react';
import { createPortal } from 'react-dom';
import { ShiftSettlementVoucher, CompanyBrandingSettings, Branch } from '../types';
import { Printer, X, CheckCircle2, Clock, AlertTriangle, Building2, Coins, DollarSign, ArrowRight } from 'lucide-react';
import { safePrint } from '../utils/storage';
import { OrcaLogo } from './OrcaLogo';

interface ShiftSettlementPrintModalProps {
  voucher: ShiftSettlementVoucher | null;
  branch?: Branch | null;
  brandingSettings?: CompanyBrandingSettings;
  onClose: () => void;
}

export const ShiftSettlementPrintModal: React.FC<ShiftSettlementPrintModalProps> = ({
  voucher,
  brandingSettings,
  onClose,
}) => {
  const { formatCurrency, formatNumber } = {
    formatCurrency: (val: number, curr: string) => `${Number(val || 0).toLocaleString('en-US')} ${curr === 'USD' ? '$' : 'ل.س'}`,
    formatNumber: (val: number) => Number(val || 0).toLocaleString('en-US'),
  };

  if (!voucher) return null;

  const handlePrint = () => {
    safePrint();
  };

  const isOutgoing = voucher.cashboxScope === 'outgoing';
  const scopeTitle = isOutgoing ? 'صندوق قسم الصادر (شحن البضائع)' : 'صندوق قسم الوارد (التسليم والتحصيل)';

  return createPortal(
    <div
      dir="rtl"
      id="shift_settlement_print_modal"
      className="orca-print-portal fixed inset-0 z-[200] overflow-hidden bg-slate-950/90 backdrop-blur-xl flex flex-col p-1 sm:p-3 md:p-5 lg:p-6 print:p-0 print:bg-white print:static animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full h-full max-w-5xl mx-auto shadow-2xl overflow-hidden flex flex-col print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100 print:text-black">
        {/* Modal Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>معاينة وطباعة سند ترصيد الوردية</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  عرض مكبّر
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                رقم السند: {voucher.voucherNumber} • {scopeTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-sm"
              title="الرجوع إلى الصفحة السابقة"
            >
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>رجوع</span>
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 bg-slate-950/80 flex justify-center print:p-0 print:bg-white print:overflow-visible print:block custom-scrollbar">
          <div
            id="printable_shift_voucher"
            className="orca-print-document w-full max-w-3xl p-8 sm:p-12 space-y-6 print:p-4 print:space-y-4 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 print:rounded-none print:shadow-none print:border-none"
          >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <OrcaLogo
                size={48}
                purpose="print"
                customLogoUrl={brandingSettings?.printLogoUrl || brandingSettings?.logoUrl}
              />
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {brandingSettings?.companyName || 'شركة أوركا للخدمات اللوجستية والشحن'}
                </h2>
                <p className="text-xs text-slate-600">
                  نظام إدارة الصناديق والترصيد المالي الموحد
                </p>
              </div>
            </div>
            <div className="text-left font-mono">
              <div className="text-base font-black text-emerald-800">
                سند ترصيد وإغلاق صندوق
              </div>
              <div className="text-xs font-bold text-slate-600 mt-1">
                رقم السند: <span className="text-slate-900">{voucher.voucherNumber}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                التاريخ: {new Date(voucher.timestamp).toLocaleDateString('ar-SY')} - {new Date(voucher.timestamp).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-300">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <span className="text-xs font-bold text-slate-800">
                نوع الصندوق المسلَّم: <span className="text-emerald-700">{scopeTitle}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {voucher.status === 'approved' ? (
                <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  معتمد ومستلم في خزينة مدير الفرع
                </span>
              ) : voucher.status === 'rejected' ? (
                <span className="px-3 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  مرفوض ومُعاد للموظف
                </span>
              ) : (
                <span className="px-3 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  قيد المراجعة والاعتماد
                </span>
              )}
            </div>
          </div>

          {/* Details Table */}
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-3 bg-slate-100 font-bold text-slate-700 w-1/4 border-r border-slate-300">
                  الموظف المسلِّم (أمين الصندوق):
                </td>
                <td className="p-3 font-semibold text-slate-900 w-1/4 border-r border-slate-300">
                  {voucher.officerName}
                </td>
                <td className="p-3 bg-slate-100 font-bold text-slate-700 w-1/4 border-r border-slate-300">
                  المستلِم (مدير الفرع / الخزينة):
                </td>
                <td className="p-3 font-semibold text-slate-900 w-1/4">
                  {voucher.managerName}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-3 bg-slate-100 font-bold text-slate-700 border-r border-slate-300">
                  تاريخ ووقت تحرير السند:
                </td>
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-300" colSpan={3}>
                  {new Date(voucher.timestamp).toLocaleString('ar-SY')}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-3 bg-slate-100 font-bold text-slate-700 border-r border-slate-300">
                  عدد الطرود والعمليات المنجزة:
                </td>
                <td className="p-3 font-bold text-slate-900 border-r border-slate-300" colSpan={3}>
                  {formatNumber(voucher.parcelsCount || 0)} حركة / طرد
                </td>
              </tr>
              {voucher.notes && (
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-100 font-bold text-slate-700 border-r border-slate-300">
                    ملاحظات وبيان تسليم الموظف:
                  </td>
                  <td className="p-3 text-slate-800 border-r border-slate-300" colSpan={3}>
                    {voucher.notes}
                  </td>
                </tr>
              )}
              {voucher.managerNotes && (
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-100 font-bold text-slate-700 border-r border-slate-300">
                    ملاحظات وتأكيد اعتماد المدير:
                  </td>
                  <td className="p-3 text-emerald-900 font-semibold border-r border-slate-300" colSpan={3}>
                    {voucher.managerNotes}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Monetary Amounts Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800">تفاصيل المبالغ النقدية المحوّلة والمستلمة:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 mb-1">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>المبلغ المسلَّم بالليرة السورية:</span>
                </div>
                <div className="text-2xl font-black text-emerald-950 font-mono">
                  {formatCurrency(voucher.sypAmount, 'SYP')}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200">
                <div className="text-xs text-cyan-800 font-bold flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-4 h-4 text-cyan-600" />
                  <span>المبلغ المسلَّم بالدولار الأمريكي:</span>
                </div>
                <div className="text-2xl font-black text-cyan-950 font-mono">
                  {formatCurrency(voucher.usdAmount, 'USD')}
                </div>
              </div>
            </div>
          </div>

          {/* Legal / Accountability Clause */}
          <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200 pt-3 text-justify">
            إقرار مالي: يقر الموظف المسلّم بأنه قام بتوريد كامل المبالغ النقدية المحصلة خلال فترة الوردية المذكورة أعلاه مطابقة للسجلات الآلية في النظام. كما يقر المستلِم باستلام المبالغ نقداً بعد عدّها ومطابقتها وإيداعها في خزينة الفرع الرئيسية.
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-800">
            <div className="text-center space-y-8">
              <div className="text-xs font-bold text-slate-800">
                توقيع الموظف المسلِّم ({voucher.officerName})
              </div>
              <div className="border-b-2 border-dashed border-slate-400 w-48 mx-auto"></div>
              <div className="text-[10px] text-slate-500">التوقيع والختم</div>
            </div>

            <div className="text-center space-y-8">
              <div className="text-xs font-bold text-slate-800">
                توقيع المستلِم / مدير الفرع ({voucher.managerName})
              </div>
              <div className="border-b-2 border-dashed border-slate-400 w-48 mx-auto"></div>
              <div className="text-[10px] text-slate-500">التوقيع والختم</div>
            </div>
          </div>
        </div>
        </div>

        {/* Bottom Sticky Control Bar (Hidden on print) */}
        <div className="p-3 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 print:hidden text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">سند ترصيد وإقفال وردية</span>
            <span className="font-mono text-emerald-400 font-bold">#{voucher.voucherNumber}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>رجوع</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
