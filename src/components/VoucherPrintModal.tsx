import React from 'react';
import { createPortal } from 'react-dom';
import { FinancialVoucher, Branch } from '../types';
import { Printer, X, FileText, CheckCircle2, Building2, Coins, ArrowRightLeft, ArrowRight } from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { safePrint } from '../utils/storage';
import { OrcaLogo } from './OrcaLogo';

interface VoucherPrintModalProps {
  voucher: FinancialVoucher | null;
  onClose: () => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({ voucher, onClose }) => {
  const { brandingSettings, branches, users, fixedAssets = [], formatCurrency, formatNumber } = useOrca();

  if (!voucher) return null;

  const branch = branches.find((b) => b.id === voucher.branchId);
  const counterpartyBranch = voucher.counterpartyBranchId
    ? branches.find((b) => b.id === voucher.counterpartyBranchId)
    : null;
  const user = users.find((u) => u.id === voucher.performedByUserId);
  const linkedAsset = voucher.assetId ? fixedAssets.find((a) => a.id === voucher.assetId) : null;

  const getVoucherTitle = (type: FinancialVoucher['type']) => {
    switch (type) {
      case 'receipt':
        return 'سند قبض نقدية (Receipt Voucher)';
      case 'payment':
        return 'سند دفع وصرف نقدية (Payment Voucher)';
      case 'transfer':
        return 'سند مناقلة أموال وصناديق بين الفروع (Inter-Branch Vault Transfer Voucher)';
      case 'clearing':
        return 'سند مقاصة ومطابقة الحسابات المالية وتوريد حصة الإدارة العامة (Clearing & Settlement Voucher)';
      default:
        return 'سند مالي';
    }
  };

  const getVoucherTypeBadge = (type: FinancialVoucher['type']) => {
    switch (type) {
      case 'receipt':
        return { label: 'سند قبض وارد', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'payment':
        return { label: 'سند دفع صادر', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'transfer':
        return { label: 'سند مناقلة صناديق بين الفروع', bg: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'clearing':
        if (branch?.type === 'agent') {
          return { label: 'سند مقاصة وكيل خارجي', bg: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
        }
        if (branch?.type === 'collection_point') {
          return { label: 'سند مقاصة نقطة تجميع', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
        }
        return { label: 'سند مقاصة ومطابقة فروع', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      default:
        return { label: 'سند مالي', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const badge = getVoucherTypeBadge(voucher.type);

  const handlePrint = () => {
    safePrint();
  };

  return createPortal(
    <div
      dir="rtl"
      id="voucher_print_modal"
      className="orca-print-portal fixed inset-0 z-[200] overflow-hidden bg-slate-950/90 backdrop-blur-xl flex flex-col p-1 sm:p-3 md:p-5 lg:p-6 print:p-0 print:bg-white print:static animate-in fade-in duration-200"
    >
      {/* Container */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full h-full max-w-6xl mx-auto shadow-2xl overflow-hidden flex flex-col print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white print:text-black">
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>معاينة وطباعة السند المالي الرسمي</span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  عرض مكبّر
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                رقم السند: {voucher.voucherNumber} • العملة: {voucher.currency === 'SYP' ? 'ليرة سورية' : 'دولار أمريكي'} • فرع {branch?.name || 'الفرع'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 sm:px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/40 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السند وكشف المطابقة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-sm"
              title="الرجوع إلى الصفحة السابقة"
            >
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>رجوع</span>
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 bg-slate-950/80 flex justify-center print:p-0 print:bg-white print:overflow-visible print:block custom-scrollbar">
          <div
            id="printable-voucher-document"
            className="orca-print-document w-full max-w-4xl bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full"
            dir="rtl"
          >
            {/* Header / Branding */}
            <div className="border-b-2 border-slate-800 pb-4 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <OrcaLogo size={46} purpose="print" />
                  <div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                      {brandingSettings.companyName || 'شركة أوركا للشحن السريع والخدمات اللوجستية'}
                    </h1>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5">
                      {brandingSettings.companySubtitle || 'الشبكة الوطنية للربط والترحيل السريع بين المحافظات السورية'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      {brandingSettings.headquartersAddress}
                      {brandingSettings.customerServicePhone
                        ? ` • خدمة الزبائن: ${brandingSettings.customerServicePhone}`
                        : brandingSettings.officialPhone
                        ? ` • هاتف: ${brandingSettings.officialPhone}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <div className="inline-block px-3 py-1 rounded-lg border text-xs font-bold mb-1 shadow-sm font-sans">
                    <span className={`px-2.5 py-0.5 rounded ${badge.bg}`}>{badge.label}</span>
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    رقم السند: <span className="text-blue-700">{voucher.voucherNumber}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    التاريخ: {voucher.date || voucher.timestamp?.split('T')[0]}
                  </div>
                </div>
              </div>
            </div>

            {/* Voucher Title Banner */}
            <div className="text-center my-3 py-2 bg-slate-100 rounded-lg border border-slate-300">
              <h2 className="text-base font-extrabold text-slate-900 tracking-wide">
                {getVoucherTitle(voucher.type)}
              </h2>
            </div>

            {/* Voucher Meta Grid */}
            <div className="grid grid-cols-2 gap-3 my-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">الفرع المنشئ للسند:</span>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                  <Building2 className="w-4 h-4 text-slate-700" />
                  <span>{branch?.name || 'الفرع'}</span>
                  <span className="text-[11px] text-slate-500 font-mono">({branch?.governorate})</span>
                  {voucher.type === 'clearing' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                      {branch?.type === 'agent'
                        ? 'مكتب وكيل خارجي (عمولات)'
                        : branch?.type === 'collection_point'
                        ? 'نقطة تجميع داخلية (عهدة)'
                        : 'فرع تشغيلي رئيسي'}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">
                  {voucher.type === 'receipt'
                    ? 'المستلم منه (المودع / العميل):'
                    : voucher.type === 'payment'
                    ? 'المدفوع له (المستفيد / الجهة):'
                    : 'الطرف المحوّل إليه (المركز الرئيسي):'}
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {voucher.paidByOrTo || (counterpartyBranch?.name ?? 'المركز الرئيسي - دمشق')}
                </div>
              </div>
            </div>

            {/* Amount Box */}
            <div className={`my-4 p-4 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-between gap-3 ${
              voucher.type === 'clearing'
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-emerald-300'
                : 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-blue-200'
            }`}>
              <div>
                <span className="text-xs font-bold text-slate-800 block mb-1">
                  {voucher.type === 'clearing'
                    ? 'صافي المبلغ المعتمد للترحيل للإدارة العامة (المقاصة):'
                    : 'المبلغ الإجمالي للسند:'}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-950 font-mono flex items-center gap-3 flex-wrap">
                  <div>
                    {formatNumber(voucher.amount ?? 0)}{' '}
                    <span className="text-sm font-sans font-bold text-slate-800">
                      {voucher.currency === 'SYP' ? 'ليرة سورية فقط لا غير' : 'دولار أمريكي'}
                    </span>
                  </div>
                  {Boolean(
                    voucher.type === 'clearing' &&
                      (voucher.clearingDetails?.totalNetPayableToHeadOfficeUsd || 0) > 0
                  ) && (
                    <div className="text-emerald-800 font-bold text-xl sm:text-2xl">
                      + {formatNumber(voucher.clearingDetails?.totalNetPayableToHeadOfficeUsd || 0)}{' '}
                      <span className="text-sm font-sans font-bold text-emerald-800">دولار أمريكي ($)</span>
                    </div>
                  )}
                </div>
              </div>

              {voucher.referenceNumber && (
                <div className="text-right sm:text-left text-xs bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-sm">
                  <span className="text-slate-500 block text-[10px]">المرجع / رقم الفاتورة:</span>
                  <span className="font-bold font-mono text-slate-800">{voucher.referenceNumber}</span>
                </div>
              )}
            </div>

            {/* Reason & Description Details */}
            <div className="space-y-3 my-4 text-xs">
              {voucher.type !== 'receipt' && voucher.reasonCategory && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-semibold block mb-1">نوع وتصنيف المعاملة:</span>
                  <div className="font-bold text-slate-800">{voucher.reasonCategory}</div>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-1">البيان والشرح التفصيلي للعملية:</span>
                <div className="text-slate-900 leading-relaxed font-medium">{voucher.description}</div>
              </div>

              {/* Linked Fixed Asset Section */}
              {linkedAsset && (
                <div className="p-3 bg-violet-50/80 rounded-lg border-2 border-violet-300 my-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-violet-950 text-xs">الأصل الثابت المربوط بالسند:</span>
                      <span className="font-extrabold text-violet-900 text-xs">{linkedAsset.name}</span>
                    </div>
                    <span className="font-mono font-bold text-violet-950 bg-violet-200/80 px-2 py-0.5 rounded border border-violet-400 text-xs">
                      كود: {linkedAsset.assetCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 mt-1.5 flex flex-wrap items-center gap-4">
                    <span>
                      <strong className="text-slate-900">العهدة:</strong> {linkedAsset.assignedEmployee || 'عهدة عامة للفرع'}
                    </span>
                    {linkedAsset.locationInBranch && (
                      <span>
                        <strong className="text-slate-900">الموقع:</strong> {linkedAsset.locationInBranch}
                      </span>
                    )}
                    {linkedAsset.serialNumber && (
                      <span className="font-mono">
                        <strong className="text-slate-900 font-sans">S/N:</strong> {linkedAsset.serialNumber}
                      </span>
                    )}
                    {linkedAsset.model && (
                      <span>
                        <strong className="text-slate-900">الموديل:</strong> {linkedAsset.model}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* If Clearing Voucher: DETAILED MATCHING STATEMENT (كشف المطابقة) */}
            {voucher.type === 'clearing' && voucher.clearingDetails && (
              <div className="my-5 p-4 rounded-xl bg-amber-50/70 border-2 border-amber-300">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-amber-800" />
                    <h3 className="font-black text-sm text-amber-950">
                      كشف مطابقة الحساب وتفصيل احتساب حصة المركز الرئيسي (المقاصة المالية)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-amber-800 font-bold">
                    الفترة: {voucher.clearingDetails.periodFrom || 'البداية'} ◄ {voucher.clearingDetails.periodTo || 'اليوم'}
                  </span>
                </div>

                {/* Chained Settlement & Operation Range Meta */}
                <div className="mb-3 p-2.5 rounded-lg bg-white border border-amber-200 text-xs text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <span className="font-bold text-amber-950">🔗 الترصيد السابق: </span>
                    {voucher.clearingDetails.previousClearingVoucherNumber ? (
                      <span className="font-mono text-emerald-700">
                        مسوى بالسند رقم [{voucher.clearingDetails.previousClearingVoucherNumber}] بتاريخ {voucher.clearingDetails.previousClearingDate}
                      </span>
                    ) : (
                      <span className="text-slate-500">أول مقاصة وترصيد للفرع (احتساب تراكمي)</span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-amber-950">نطاق الحركات: </span>
                    <span className="font-mono text-slate-800 text-[11px]">
                      {voucher.clearingDetails.firstOperationRef || 'البداية'} ◄ {voucher.clearingDetails.lastOperationRef || 'الختام'}
                    </span>
                  </div>
                </div>

                {/* The 4 Key Figures Compact Bar */}
                <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                  <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200">
                    <span className="text-[10px] text-slate-600 block">إجمالي المحصل</span>
                    <span className="font-bold font-mono text-slate-900">
                      {formatCurrency(voucher.clearingDetails.totalGrossAmountSyp || voucher.clearingDetails.totalShippingCollectedSyp || 0, 'SYP')}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-700 block">المصاريف التشغيلية</span>
                    <span className="font-bold font-mono text-rose-800">
                      -{formatCurrency(voucher.clearingDetails.totalExpensesSyp || 0, 'SYP')}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200">
                    <span className="text-[10px] text-amber-800 block">نسبة وإيراد الفرع</span>
                    <span className="font-bold font-mono text-amber-900">
                      {formatCurrency(voucher.clearingDetails.totalBranchShareSyp || voucher.clearingDetails.branchShippingCommissionAmountSyp || 0, 'SYP')}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300">
                    <span className="text-[10px] text-emerald-800 block font-bold">المرحل للشركة</span>
                    <span className="font-black font-mono text-emerald-950 text-sm">
                      {formatCurrency(voucher.clearingDetails.totalNetPayableToHeadOfficeSyp || 0, 'SYP')}
                    </span>
                  </div>
                </div>

                {/* Calculation Breakdown Table */}
                <table className="w-full text-xs text-right border border-amber-200 bg-white rounded-lg overflow-hidden mb-3">
                  <thead>
                    <tr className="bg-amber-100/80 text-amber-950 font-bold border-b border-amber-200">
                      <th className="p-2">البند والبيان المحاسبي</th>
                      <th className="p-2 text-center">الإجمالي المقبوض بالفرع</th>
                      <th className="p-2 text-center">نسبة عمولة الفرع</th>
                      <th className="p-2 text-center">مبلغ عمولة الفرع المستقطع</th>
                      <th className="p-2 text-left">صافي حصة الإدارة المحولة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 font-mono">
                    <tr>
                      <td className="p-2 font-sans font-semibold text-slate-800">
                        أجور شحن البضائع والطرود ({voucher.clearingDetails.parcelsCount || 0} طرد)
                      </td>
                      <td className="p-2 text-center font-bold">
                        {formatCurrency(voucher.clearingDetails.totalShippingCollectedSyp || 0, 'SYP')}
                        {(voucher.clearingDetails.totalShippingCollectedUsd || 0) > 0 && (
                          <div className="text-slate-500 font-normal">
                            + {formatCurrency(voucher.clearingDetails.totalShippingCollectedUsd || 0, 'USD')}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center font-sans font-bold text-blue-700">
                        {voucher.clearingDetails.branchShippingCommissionPercent || 0}%
                      </td>
                      <td className="p-2 text-center font-bold text-rose-700">
                        -{formatCurrency(voucher.clearingDetails.branchShippingCommissionAmountSyp || 0, 'SYP')}
                        {(voucher.clearingDetails.branchShippingCommissionAmountUsd || 0) > 0 && (
                          <div>-{formatCurrency(voucher.clearingDetails.branchShippingCommissionAmountUsd, 'USD')}</div>
                        )}
                      </td>
                      <td className="p-2 text-left font-black text-emerald-800 text-sm">
                        {formatCurrency(voucher.clearingDetails.headOfficeNetShippingShareSyp || 0, 'SYP')}
                        {(voucher.clearingDetails.headOfficeNetShippingShareUsd || 0) > 0 && (
                          <div>+ {formatCurrency(voucher.clearingDetails.headOfficeNetShippingShareUsd, 'USD')}</div>
                        )}
                      </td>
                    </tr>

                    {((voucher.clearingDetails.totalCodCollectedSyp || 0) > 0 ||
                      (voucher.clearingDetails.totalCodCollectedUsd || 0) > 0) && (
                      <tr>
                        <td className="p-2 font-sans font-semibold text-slate-800">
                          تحصيلات المبالغ والحوالات النقدية (COD)
                        </td>
                        <td className="p-2 text-center font-bold">
                          {formatCurrency(voucher.clearingDetails.totalCodCollectedSyp || 0, 'SYP')}
                        </td>
                        <td className="p-2 text-center font-sans font-bold text-blue-700">
                          {voucher.clearingDetails.branchCodCommissionPercent || 0}%
                        </td>
                        <td className="p-2 text-center font-bold text-rose-700">
                          -{formatCurrency(voucher.clearingDetails.branchCodCommissionAmountSyp || 0, 'SYP')}
                        </td>
                        <td className="p-2 text-left font-black text-emerald-800">
                          {formatCurrency(
                            (voucher.clearingDetails.totalCodCollectedSyp || 0) -
                            (voucher.clearingDetails.branchCodCommissionAmountSyp || 0),
                            'SYP'
                          )}
                        </td>
                      </tr>
                    )}

                    {(voucher.clearingDetails.totalExpensesSyp || 0) > 0 && (
                      <tr>
                        <td className="p-2 font-sans font-semibold text-rose-800">
                          المصاريف التشغيلية المدفوعة بالفرع
                        </td>
                        <td className="p-2 text-center font-bold text-rose-700">
                          -{formatCurrency(voucher.clearingDetails.totalExpensesSyp || 0, 'SYP')}
                        </td>
                        <td className="p-2 text-center font-sans text-slate-500">خصم</td>
                        <td className="p-2 text-center text-slate-500">-</td>
                        <td className="p-2 text-left font-bold text-rose-700">
                          -{formatCurrency(voucher.clearingDetails.totalExpensesSyp || 0, 'SYP')}
                        </td>
                      </tr>
                    )}

                    {(voucher.clearingDetails.totalTransferredAmountsSyp || 0) > 0 && (
                      <tr className="bg-indigo-50/50">
                        <td className="p-2 font-sans font-semibold text-indigo-900">
                          مبالغ محوّلة لأجور الموزعين في الجهة المقابلة (تخصم من حصة الشركة)
                        </td>
                        <td className="p-2 text-center font-bold text-indigo-800">
                          {formatCurrency(voucher.clearingDetails.totalTransferredAmountsSyp || 0, 'SYP')}
                        </td>
                        <td className="p-2 text-center font-sans text-indigo-700 font-bold">خصم إدارة</td>
                        <td className="p-2 text-center text-slate-500">-</td>
                        <td className="p-2 text-left font-bold text-rose-700">
                          -{formatCurrency(voucher.clearingDetails.totalTransferredAmountsSyp || 0, 'SYP')}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-amber-100/60 font-sans font-bold">
                      <td colSpan={4} className="p-2 text-amber-950 text-sm">
                        الصافي الإجمالي المعتمد للتحويل لحساب الإدارة العامة بموجب المقاصة:
                      </td>
                      <td className="p-2 text-left font-mono font-black text-base text-emerald-900">
                        {formatCurrency(voucher.clearingDetails.totalNetPayableToHeadOfficeSyp || 0, 'SYP')}
                        {(voucher.clearingDetails.totalNetPayableToHeadOfficeUsd || 0) > 0 && (
                          <div>/ {formatCurrency(voucher.clearingDetails.totalNetPayableToHeadOfficeUsd, 'USD')}</div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Operations Table snapshot if available */}
                {voucher.clearingDetails.operations && voucher.clearingDetails.operations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-amber-200">
                    <div className="text-[11px] font-bold text-amber-950 mb-1.5 flex items-center justify-between">
                      <span>كشف العمليات المشمولة بالترصيد والمقاصة ({voucher.clearingDetails.operations.length} حركة):</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] text-right border border-amber-200 bg-white">
                        <thead className="bg-amber-50 text-amber-900 font-bold">
                          <tr>
                            <th className="p-1.5">ت</th>
                            <th className="p-1.5">رقم الحركة</th>
                            <th className="p-1.5">التاريخ</th>
                            <th className="p-1.5">النوع</th>
                            <th className="p-1.5 text-left">المبلغ</th>
                            <th className="p-1.5 text-center">النسبة</th>
                            <th className="p-1.5 text-left">إيراد الفرع</th>
                            <th className="p-1.5 text-left">حصة المركز</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 font-mono">
                          {voucher.clearingDetails.operations.map((op, i) => (
                            <tr key={op.id || i}>
                              <td className="p-1 text-center text-slate-500">{i + 1}</td>
                              <td className="p-1 font-bold text-slate-800">{op.operationNumber}</td>
                              <td className="p-1 text-slate-600">{op.date}</td>
                              <td className="p-1 font-sans">{op.typeLabel}</td>
                              <td className="p-1 text-left font-bold">{formatCurrency(op.grossAmount, op.currency)}</td>
                              <td className="p-1 text-center font-sans">{op.branchCommissionRate > 0 ? `${op.branchCommissionRate}%` : '-'}</td>
                              <td className="p-1 text-left font-bold text-amber-700">
                                {op.branchCommissionAmount > 0 ? formatCurrency(op.branchCommissionAmount, op.currency) : '-'}
                              </td>
                              <td className="p-1 text-left font-bold text-emerald-800">
                                {op.type === 'branch_expense' ? `-${formatCurrency(op.grossAmount, op.currency)}` : formatCurrency(op.companyShareAmount, op.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {voucher.clearingDetails.reconciliationNotes && (
                  <p className="text-[11px] text-amber-900 leading-relaxed font-sans mt-2">
                    <span className="font-bold">ملاحظات التدقيق والمطابقة: </span>
                    {voucher.clearingDetails.reconciliationNotes}
                  </p>
                )}
              </div>
            )}

            {/* Official Signatures Grid */}
            <div className="grid grid-cols-4 gap-3 pt-6 mt-6 border-t-2 border-slate-300 text-center text-xs">
              <div>
                <span className="text-slate-500 font-semibold block mb-8">منظم السند / الموظف</span>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                  {user?.name || 'أمين الصندوق'}
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-8">مدقق الحسابات</span>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                  المحاسب المالي
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-8">مدير الفرع</span>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                  {branch?.managerName || 'مدير المركز'}
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-8">المستلم / المفوض</span>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-800">
                  التوقيع والختم الرسمي
                </div>
              </div>
            </div>

            {/* Footer notes */}
            <div className="mt-6 pt-3 border-t border-slate-200 text-[10px] text-slate-500 text-center font-mono">
              سند مالي رسمي صادر عن نظام أوركا اللوجستي الموحد • رقم القيد الإلكتروني: {voucher.id} • تم
              التحرير بتاريخ {voucher.timestamp}
            </div>
          </div>
        </div>

        {/* Bottom Control Bar (Hidden on print) */}
        <div className="p-3 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 print:hidden text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">سند مالي رسمي</span>
            <span className="font-mono text-cyan-400 font-bold">#{voucher.voucherNumber}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-sm"
            >
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>رجوع</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-950/40"
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
