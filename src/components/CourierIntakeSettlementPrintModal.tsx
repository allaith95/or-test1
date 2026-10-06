import React from 'react';
import { createPortal } from 'react-dom';
import { CourierIntakeSettlementVoucher, CompanyBrandingSettings, Branch, Parcel } from '../types';
import { Printer, ArrowRight, Building2, CheckCircle2, Package, ShieldCheck, UserCheck } from 'lucide-react';
import { safePrint } from '../utils/storage';
import { OrcaLogo } from './OrcaLogo';

interface CourierIntakeSettlementPrintModalProps {
  voucher: CourierIntakeSettlementVoucher | null;
  parcels: Parcel[];
  branch?: Branch | null;
  brandingSettings?: CompanyBrandingSettings;
  onClose: () => void;
}

export const CourierIntakeSettlementPrintModal: React.FC<CourierIntakeSettlementPrintModalProps> = ({
  voucher,
  parcels,
  branch,
  brandingSettings,
  onClose,
}) => {
  if (!voucher) return null;

  const handlePrint = () => {
    safePrint();
  };

  const voucherParcels = parcels.filter((p) => voucher.parcelIds.includes(p.id));

  const formatCurrency = (val: number, curr: string) =>
    `${Number(val || 0).toLocaleString('en-US')} ${curr === 'USD' ? '$' : 'ل.س'}`;

  const formatNumber = (val: number) => Number(val || 0).toLocaleString('en-US');

  const companyName = brandingSettings?.companyName || 'شركة أوركا للشحن والخدمات اللوجستية';
  const customerServicePhone = brandingSettings?.customerServicePhone || brandingSettings?.officialPhone || '0991234567';

  return createPortal(
    <div
      dir="rtl"
      id="courier_intake_settlement_print_modal"
      className="orca-print-portal fixed inset-0 z-[200] overflow-hidden bg-slate-950/90 backdrop-blur-xl flex flex-col p-1 sm:p-3 md:p-5 lg:p-6 print:p-0 print:bg-white print:static animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full h-full max-w-5xl mx-auto shadow-2xl overflow-hidden flex flex-col print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100 print:text-black">
        {/* Modal Header (Hidden in Print) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>سند توريد وترصيد مقبوضات تسجيل الطرود الميدانية</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  عزل الصندوق المالي
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                رقم السند: {voucher.voucherNumber} • الموزع: {voucher.courierName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة إشعار الاستلام والسند</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-sm"
            >
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>رجوع</span>
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/60 print:bg-white print:p-6 print:overflow-visible text-slate-100 print:text-black">
          <div id="printable_courier_settlement" className="orca-print-document max-w-4xl mx-auto bg-white text-black p-6 sm:p-10 rounded-2xl print:rounded-none shadow-xl print:shadow-none border border-slate-200 print:border-black/40 font-['Cairo',sans-serif] space-y-6">
            
            {/* Header / Brand */}
            <div className="flex items-start justify-between border-b-2 border-black pb-4">
              <div className="flex items-center gap-3">
                <OrcaLogo monochrome size={48} circularBg={false} />
                <div>
                  <h1 className="text-lg sm:text-xl font-black text-black tracking-tight">
                    {companyName}
                  </h1>
                  <p className="text-xs text-gray-700 font-bold mt-0.5">
                    إدارة الحسابات المالية واللوجستية • قسم الصادر والاستلام
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono mt-0.5">
                    هاتف خدمة الزبائن المعتمد: {customerServicePhone}
                  </p>
                </div>
              </div>

              <div className="text-left">
                <div className="inline-block border-2 border-black px-3 py-1 rounded-lg bg-amber-50 print:bg-transparent">
                  <span className="text-[10px] font-bold text-gray-700 block text-center">سند استلام وترصيد طرود</span>
                  <span className="text-sm sm:text-base font-black font-mono tracking-wider text-black block text-center">
                    {voucher.voucherNumber}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600 font-mono mt-1 text-left">
                  {new Date(voucher.timestamp).toLocaleDateString('ar-SY')} - {new Date(voucher.timestamp).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 text-center">
              <h2 className="text-base sm:text-lg font-black text-black">
                إشعار استلام طرود وتسوية صندوق مقبوضات الموزع الميداني
              </h2>
              <p className="text-xs text-gray-700 mt-1">
                يشهد قسم العمليات والخزينة باستلام الطرود المسجلة ميدانياً أدناه من الموزع، وتوريد المبالغ المحصلة سلفاً إلى صندوق الفرع
              </p>
            </div>

            {/* Courier & Branch Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">اسم الموزع الميداني:</span>
                <span className="font-black text-black text-sm">{voucher.courierName}</span>
                {voucher.courierPhone && (
                  <span className="block text-[10px] text-gray-600 font-mono">{voucher.courierPhone}</span>
                )}
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">فرع الاستلام / المركز:</span>
                <span className="font-bold text-black">{branch?.name || 'الفرع الرئيسي'}</span>
                {branch?.governorate && (
                  <span className="block text-[10px] text-gray-600">({branch.governorate})</span>
                )}
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">موظف الاستلام والتدقيق:</span>
                <span className="font-bold text-black">{voucher.receivedByUserName}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] font-bold">إجمالي عدد الطرود:</span>
                <span className="font-black text-black font-mono text-sm">{voucher.parcelsCount} طرد</span>
              </div>
            </div>

            {/* Parcels Itemized Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-black flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-black" />
                  <span>بيان الطرود المستلمة والمفحوصة بنجاح:</span>
                </h3>
                <span className="text-[10px] text-gray-600 font-bold">
                  تم فحص الباركود والتحقق من سلامة الشحنات
                </span>
              </div>

              <div className="border border-black rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-900 border-b border-black font-black text-[11px]">
                    <tr>
                      <th className="py-2 px-2.5 w-10 text-center">#</th>
                      <th className="py-2 px-2.5">رقم البوليصة</th>
                      <th className="py-2 px-2.5">المرسل</th>
                      <th className="py-2 px-2.5">المستلم والوجهة</th>
                      <th className="py-2 px-2.5 text-center">نوع الدفع</th>
                      <th className="py-2 px-2.5 text-left">أجور الشحن المقبوضة سلفاً</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px]">
                    {voucherParcels.map((parcel, idx) => {
                      const isPrepaid = parcel.paymentType === 'prepaid' || (parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender');
                      return (
                        <tr key={parcel.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                          <td className="py-2 px-2.5 text-center font-mono font-bold text-gray-600">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-black text-black">
                            {parcel.trackingNumber}
                            {parcel.paperReceiptNumber && (
                              <span className="block text-[9.5px] text-gray-500 font-sans">
                                وصل يدوي: {parcel.paperReceiptNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-black">{parcel.sender.name}</span>
                            <span className="block text-[9.5px] text-gray-500 font-mono">{parcel.sender.phone}</span>
                          </td>
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-black">{parcel.receiver.name}</span>
                            <span className="block text-[9.5px] text-gray-500">
                              {parcel.destinationAddress}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isPrepaid ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {isPrepaid ? 'مدفوع سلفاً' : 'تحصيل عند الاستلام'}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-left font-mono font-black text-black">
                            {isPrepaid ? formatCurrency(parcel.shippingCost, parcel.currency) : '0 ل.س (تحصيل وجهة)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Settlement Totals Box */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-400/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>تأكيد الترصيد المالي وإغلاق صندوق تسجيل الموزع:</span>
                </span>
                <p className="text-[11px] text-gray-700">
                  تم توريد كامل المبالغ النقدية المحصلة من قبل الموزع لقاء تسجيل الطرود أعلاه وتصفير صندوق مقبوضات التسجيل.
                </p>
                {voucher.notes && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    <span className="font-bold">ملاحظات:</span> {voucher.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 bg-white border border-amber-300 px-5 py-3 rounded-xl shadow-sm text-left">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 block">المقبوضات الموردة (ل.س):</span>
                  <span className="text-lg font-black font-mono text-black">
                    {formatNumber(voucher.totalPrepaidSyp)} <span className="text-xs font-normal">ل.س</span>
                  </span>
                </div>
                {voucher.totalPrepaidUsd > 0 && (
                  <div className="border-r border-gray-300 pr-4">
                    <span className="text-[10px] font-bold text-gray-500 block">المقبوضات الموردة ($):</span>
                    <span className="text-lg font-black font-mono text-emerald-700">
                      ${formatNumber(voucher.totalPrepaidUsd)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Official Signatures & Stamping */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-gray-200 text-center text-xs">
              <div className="space-y-8">
                <div className="font-bold text-gray-700">
                  <span>توقيع الموزع المسلّم</span>
                  <p className="text-[10px] text-gray-500 font-normal">أقر بتسليم كافة الطرود والمبالغ المذكورة</p>
                </div>
                <div className="border-b border-black w-3/4 mx-auto pb-1 font-bold font-mono text-gray-800">
                  {voucher.courierName}
                </div>
              </div>

              <div className="space-y-8">
                <div className="font-bold text-gray-700">
                  <span>أمين الصندوق / مدقق الفرع</span>
                  <p className="text-[10px] text-gray-500 font-normal">تم التدقيق والاستلام الفعلي والنقدي</p>
                </div>
                <div className="border-b border-black w-3/4 mx-auto pb-1 font-bold font-mono text-gray-800">
                  {voucher.receivedByUserName}
                </div>
              </div>

              <div className="space-y-8">
                <div className="font-bold text-gray-700">
                  <span>خاتم وتصديق الإدارة المالية</span>
                  <p className="text-[10px] text-gray-500 font-normal">معتمد من إدارة أوركا اللوجستية</p>
                </div>
                <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto pb-1 text-gray-400 text-[10px]">
                  (الختم الرسمي)
                </div>
              </div>
            </div>

            {/* Print Footer Notice */}
            <div className="pt-3 border-t border-gray-200 text-[9px] text-gray-500 flex items-center justify-between font-mono">
              <span>طُبع بواسطة نظام أوركا لإدارة الشحن والخدمات اللوجستية</span>
              <span>تاريخ الطباعة: {new Date().toLocaleString('ar-SY')}</span>
              <span>سند رسمي غير قابل للتعديل</span>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
