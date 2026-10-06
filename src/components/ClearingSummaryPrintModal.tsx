import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  FileText,
  Calculator,
  ShieldCheck,
  Hash,
  Coins,
} from 'lucide-react';
import { FinancialVoucher, ClearingOperationItem } from '../types';
import { useOrca } from '../context/OrcaContext';
import { safePrint } from '../utils/storage';
import { OrcaLogo } from './OrcaLogo';

interface ClearingSummaryPrintModalProps {
  voucher: FinancialVoucher | null;
  onClose: () => void;
  autoPrint?: boolean;
}

// Arabic Number to Words helper (تفقيط مبسط ودقيق للعمليات المالية)
function spellArabicCurrency(amount: number, currency: 'SYP' | 'USD'): string {
  if (!amount || isNaN(amount)) return '';
  const num = Math.floor(Math.abs(amount));

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = [
    'أحد عشر',
    'اثنا عشر',
    'ثلاثة عشر',
    'أربعة عشر',
    'خمسة عشر',
    'ستة عشر',
    'سبعة عشر',
    'ثمانية عشر',
    'تسعة عشر',
  ];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n: number): string {
    let result = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) {
      result += hundreds[h];
      if (remainder > 0) result += ' و';
    }

    if (remainder >= 11 && remainder <= 19) {
      result += teens[remainder - 11];
    } else {
      if (u > 0) {
        result += units[u];
        if (t > 0) result += ' و';
      }
      if (t > 0) {
        result += tens[t];
      }
    }
    return result;
  }

  if (num === 0) return currency === 'SYP' ? 'صفر ليرة سورية' : 'صفر دولار أمريكي';

  let result = '';
  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const ones = num % 1000;

  if (billions > 0) {
    result += `${convertGroup(billions)} مليار`;
    if (millions > 0 || thousands > 0 || ones > 0) result += ' و';
  }
  if (millions > 0) {
    if (millions === 1) result += 'مليون';
    else if (millions === 2) result += 'مليونان';
    else if (millions >= 3 && millions <= 10) result += `${convertGroup(millions)} ملايين`;
    else result += `${convertGroup(millions)} مليون`;
    if (thousands > 0 || ones > 0) result += ' و';
  }
  if (thousands > 0) {
    if (thousands === 1) result += 'ألف';
    else if (thousands === 2) result += 'ألفان';
    else if (thousands >= 3 && thousands <= 10) result += `${convertGroup(thousands)} آلاف`;
    else result += `${convertGroup(thousands)} ألف`;
    if (ones > 0) result += ' و';
  }
  if (ones > 0) {
    result += convertGroup(ones);
  }

  const currencyUnit = currency === 'SYP' ? 'ليرة سورية' : 'دولار أمريكي';
  return `فقط ${result.trim()} ${currencyUnit} لا غير`;
}

export const ClearingSummaryPrintModal: React.FC<ClearingSummaryPrintModalProps> = ({
  voucher,
  onClose,
  autoPrint = false,
}) => {
  const { branches, users, formatCurrency } = useOrca();

  React.useEffect(() => {
    if (autoPrint && voucher) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, voucher]);

  if (!voucher) return null;

  const cd = voucher.clearingDetails;
  const agentBranch = branches.find((b) => b.id === voucher.branchId);
  const headOfficeBranch = branches.find((b) => b.id === voucher.counterpartyBranchId) || {
    id: 'hq',
    name: 'الإدارة العامة - المركز الرئيسي',
    city: 'دمشق',
    address: 'الإدارة العامة للشحن والمقاصة',
  };
  const accountantUser = users.find((u) => u.id === voucher.performedByUserId);

  // Separate operations into Outbound (صادر), Inbound (وارد), and Expenses (مصاريف)
  const operations = cd?.operations || [];

  const outboundOperations = operations.filter(
    (op) => op.type === 'shipping_prepaid' || (op.typeLabel && op.typeLabel.includes('صادر'))
  );

  const inboundOperations = operations.filter(
    (op) =>
      op.type === 'shipping_collect' ||
      op.type === 'cod_collection' ||
      op.type === 'transfer_fee' ||
      (op.typeLabel && (op.typeLabel.includes('وارد') || op.typeLabel.includes('تحصيل')))
  );

  const expenseOperations = operations.filter(
    (op) => op.type === 'branch_expense' || (op.typeLabel && op.typeLabel.includes('مصروف'))
  );

  // Financial summary numbers
  const totalGrossSyp = cd?.totalGrossAmountSyp ?? ((cd?.totalShippingCollectedSyp ?? 0) + (cd?.totalCodCollectedSyp ?? 0));
  const totalGrossUsd = cd?.totalGrossAmountUsd ?? ((cd?.totalShippingCollectedUsd ?? 0) + (cd?.totalCodCollectedUsd ?? 0));

  const totalCommissionSyp =
    cd?.totalBranchShareSyp ??
    ((cd?.branchShippingCommissionAmountSyp ?? 0) + (cd?.branchCodCommissionAmountSyp ?? 0));
  const totalCommissionUsd =
    cd?.totalBranchShareUsd ??
    ((cd?.branchShippingCommissionAmountUsd ?? 0) + (cd?.branchCodCommissionAmountUsd ?? 0));

  const totalExpensesSyp = cd?.totalExpensesSyp ?? 0;
  const totalExpensesUsd = cd?.totalExpensesUsd ?? 0;

  const netPayableSyp = cd?.totalNetPayableToHeadOfficeSyp ?? voucher.amount;
  const netPayableUsd = cd?.totalNetPayableToHeadOfficeUsd ?? 0;

  const settlementMethodLabel =
    voucher.settlementMethod === 'instant_cash' || cd?.settlementMethod === 'instant_cash'
      ? 'توريد نقدي فوري مع استلام رسمي'
      : voucher.settlementMethod === 'bank_transfer' || cd?.settlementMethod === 'bank_transfer'
      ? `حوالة مصرفية رسمية (${cd?.bankName || 'البنك المعتمد'})`
      : 'قيد على الحساب الجاري للوكيل';

  const printedAt = new Date().toLocaleString('ar-SY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return createPortal(
    <div
      dir="rtl"
      id="clearing_summary_print_modal"
      className="orca-print-portal fixed inset-0 z-[200] overflow-y-auto bg-slate-950/85 backdrop-blur-sm flex justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      {/* Container sizing: A4 Portrait Dimensions */}
      <div
        id="printable_clearing_statement"
        className="orca-print-document bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] shadow-2xl rounded-2xl print:rounded-none print:shadow-none print:border-none flex flex-col justify-between p-6 sm:p-8 relative"
      >
        {/* On-screen toolbar (Hidden during print) */}
        <div className="print:hidden flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">ملخص مقاصة حسابات الوكيل (ورقة A4 رسمية)</h2>
              <p className="text-xs text-slate-500">جاهز للطباعة المباشرة والإرفاق مع المبلغ المحول</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => safePrint()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-xl transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* A4 PRINTABLE DOCUMENT BODY                                */}
        {/* ========================================================= */}
        <div className="space-y-4">
          {/* 1. OFFICIAL DOCUMENT HEADER */}
          <div className="border-b-2 border-slate-900 pb-3">
            <div className="flex items-start justify-between">
              {/* Right: Company Branding */}
              <div className="text-right space-y-0.5">
                <div className="flex items-center gap-2">
                  <OrcaLogo size={36} purpose="print" />
                  <div>
                    <h1 className="text-base font-black text-slate-900 leading-tight">
                      شركة أوركا للشحن السريع والخدمات اللوجستية
                    </h1>
                    <p className="text-[11px] text-slate-600 font-semibold">
                      نظام الحسابات المركزية وإدارة مقاصة الوكلاء
                    </p>
                  </div>
                </div>
              </div>

              {/* Center: Prominent Document Title Badge */}
              <div className="text-center px-4 py-1.5 bg-slate-100 border-2 border-slate-800 rounded-xl">
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-wide">
                  كشف ملخص مقاصة وتصفية حسابات الوكيل
                </h2>
                <div className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                  AGENT CLEARING & SETTLEMENT STATEMENT
                </div>
              </div>

              {/* Left: Voucher Metadata Box */}
              <div className="text-left font-mono text-xs space-y-1">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-bold text-slate-900 text-sm bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {voucher.voucherNumber}
                  </span>
                  <span className="font-sans font-bold text-slate-600">:رقم السند</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-[11px]">
                  <span className="text-slate-800 font-bold">{voucher.date || voucher.timestamp?.split('T')[0]}</span>
                  <span className="font-sans text-slate-500">:تاريخ الترصيد</span>
                </div>
                {cd?.linkedReceiptVoucherNumber && (
                  <div className="flex items-center justify-end gap-1 text-[11px]">
                    <span className="text-emerald-800 font-bold">{cd.linkedReceiptVoucherNumber}</span>
                    <span className="font-sans text-slate-500">:سند القبض المرتبط</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. RECONCILIATION PARTIES & SCOPE BAR */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-300 rounded-xl p-3">
            {/* Agent Info */}
            <div className="space-y-1 border-l border-slate-200 pl-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Building2 className="w-3.5 h-3.5 text-slate-700" />
                <span>الطرف الأول (الوكيل المعني):</span>
                <span className="text-emerald-800 font-black">{agentBranch?.name || voucher.branchId}</span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-3">
                <span>المحافظة/المدينة: <strong>{agentBranch?.city || 'سوريا'}</strong></span>
                <span>•</span>
                <span>هاتف المكتب: <strong className="font-mono">{agentBranch?.phone || '—'}</strong></span>
              </div>
            </div>

            {/* Destination / HQ Info */}
            <div className="space-y-1 pr-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
                <span>الطرف الثاني (المركز الرئيسي المستلم):</span>
                <span className="text-slate-900 font-black">{headOfficeBranch.name}</span>
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-3">
                <span>الفترة المغطاة: <strong className="font-mono">{cd?.periodFrom || 'البداية'} ◄ {cd?.periodTo || 'الآن'}</strong></span>
                <span>•</span>
                <span>طريقة التوريد: <strong className="text-slate-800">{settlementMethodLabel}</strong></span>
              </div>
            </div>
          </div>

          {/* 3. MATHEMATICAL BALANCE EQUATION BLOCK (معادلة تصفية الرصيد النهائي) */}
          <div className="border-2 border-slate-900 rounded-2xl bg-gradient-to-b from-slate-50 to-emerald-50/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-800" />
                <span className="font-black text-xs sm:text-sm text-slate-900">
                  معادلة تصفية الرصيد النهائي (مرجع المطابقة القطعية)
                </span>
              </div>
              <span className="text-[11px] text-slate-600 font-semibold">
                إجمالي الأوامر والعمليات المطابقة: <strong className="font-mono text-slate-900">{cd?.operationsCount || operations.length}</strong>
              </span>
            </div>

            {/* Equation Strip */}
            <div className="grid grid-cols-7 items-center text-center gap-1">
              {/* Item 1: Total Gross Collected */}
              <div className="col-span-2 bg-white border border-slate-300 rounded-xl p-2 shadow-xs">
                <div className="text-[10px] text-slate-500 font-bold">1. إجمالي المقبوض لدى الوكيل</div>
                <div className="text-[9px] text-slate-400 font-medium">(أجور شحن صادر + تحصيلات COD)</div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-900 mt-1">
                  {formatCurrency(totalGrossSyp, 'SYP')}
                </div>
                {totalGrossUsd > 0 && (
                  <div className="text-[10px] font-mono font-bold text-slate-700">+{formatCurrency(totalGrossUsd, 'USD')}</div>
                )}
              </div>

              {/* Operator: Minus */}
              <div className="text-base sm:text-lg font-black text-slate-400 font-mono">-</div>

              {/* Item 2: Agent Commission */}
              <div className="col-span-2 bg-white border border-rose-200 rounded-xl p-2 shadow-xs">
                <div className="text-[10px] text-rose-700 font-bold">2. عمولة الوكيل المستحقة</div>
                <div className="text-[9px] text-slate-400 font-medium">({cd?.branchShippingCommissionPercent || 15}% شحن + {cd?.branchCodCommissionPercent || 20}% تحصيل)</div>
                <div className="text-sm sm:text-base font-black font-mono text-rose-700 mt-1">
                  -{formatCurrency(totalCommissionSyp, 'SYP')}
                </div>
                {totalCommissionUsd > 0 && (
                  <div className="text-[10px] font-mono font-bold text-rose-700">-{formatCurrency(totalCommissionUsd, 'USD')}</div>
                )}
              </div>

              {/* Operator: Equals */}
              <div className="text-base sm:text-lg font-black text-slate-400 font-mono">=</div>

              {/* Item 3: Net Remittance */}
              <div className="col-span-1 bg-emerald-900 text-white rounded-xl p-2 shadow-sm border border-emerald-950">
                <div className="text-[10px] text-emerald-200 font-bold">3. الصافي المورد للإدارة</div>
                <div className="text-[9px] text-emerald-300/80 font-medium">المبلغ المرفق نقداً</div>
                <div className="text-sm sm:text-base font-black font-mono text-emerald-300 mt-1">
                  {formatCurrency(netPayableSyp, 'SYP')}
                </div>
                {netPayableUsd > 0 && (
                  <div className="text-[10px] font-mono font-bold text-emerald-300">+{formatCurrency(netPayableUsd, 'USD')}</div>
                )}
              </div>
            </div>

            {/* Expenses Deduction Note if present */}
            {totalExpensesSyp > 0 && (
              <div className="text-[10px] bg-white border border-slate-200 rounded-lg p-1.5 flex items-center justify-between text-slate-700">
                <span>
                  * تم اعتماد خصم مصاريف تشغيلية بموجب سندات رسمية بمبلغ:
                </span>
                <span className="font-mono font-bold text-rose-700">
                  {formatCurrency(totalExpensesSyp, 'SYP')}
                </span>
              </div>
            )}

            {/* Spelled Currency in Arabic */}
            <div className="bg-white border border-slate-300 rounded-xl p-2 text-center">
              <span className="text-[11px] font-bold text-slate-800">
                المبلغ الصافي المطلوب توريده كتابةً:{' '}
              </span>
              <span className="text-xs font-black text-emerald-900">
                {spellArabicCurrency(netPayableSyp, 'SYP')}
              </span>
              {netPayableUsd > 0 && (
                <span className="text-xs font-black text-slate-800">
                  {' '}مع إضافة {spellArabicCurrency(netPayableUsd, 'USD')}
                </span>
              )}
            </div>
          </div>

          {/* 4. DETAILED OPERATIONS TABLE (الصادر والوارد) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                <span>جدول بيان وتفصيل عمليات الوكيل المعتمدة في هذا السند</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                إجمالي العمليات: {operations.length} عملية
              </span>
            </div>

            {/* Table Container */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-[10px] text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                    <th className="p-1.5 text-center font-mono w-6">#</th>
                    <th className="p-1.5 font-bold">رقم العملية / البوليصة</th>
                    <th className="p-1.5 font-bold">التاريخ</th>
                    <th className="p-1.5 font-bold">نوع الحركة</th>
                    <th className="p-1.5 font-bold">البيان والأطراف</th>
                    <th className="p-1.5 text-left font-bold">المبلغ المقبوض</th>
                    <th className="p-1.5 text-left font-bold">عمولة الوكيل</th>
                    <th className="p-1.5 text-left font-bold">صافي المركز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {operations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 font-medium">
                        لا توجد حركات تفصيلية ملحقة بالسند — تم اعتماد الترصيد الإجمالي بناءً على دفاتر الفرع.
                      </td>
                    </tr>
                  ) : (
                    operations.slice(0, 45).map((op, idx) => {
                      const isOutbound = op.type === 'shipping_prepaid';
                      const isExpense = op.type === 'branch_expense';

                      return (
                        <tr
                          key={op.id || idx}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          <td className="p-1.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-1.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {op.operationNumber}
                          </td>
                          <td className="p-1.5 font-mono text-slate-600 whitespace-nowrap">
                            {op.date}
                          </td>
                          <td className="p-1.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isOutbound
                                  ? 'bg-blue-100 text-blue-800'
                                  : isExpense
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {op.typeLabel || (isOutbound ? 'صادر' : 'وارد')}
                            </span>
                          </td>
                          <td className="p-1.5 max-w-[150px] truncate text-slate-700" title={op.description}>
                            {op.description}
                          </td>
                          <td className="p-1.5 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(op.grossAmount, op.currency || 'SYP')}
                          </td>
                          <td className="p-1.5 text-left font-mono font-bold text-rose-700 whitespace-nowrap">
                            {op.branchCommissionAmount > 0
                              ? formatCurrency(op.branchCommissionAmount, op.currency || 'SYP')
                              : '—'}
                          </td>
                          <td className="p-1.5 text-left font-mono font-bold text-emerald-800 whitespace-nowrap">
                            {formatCurrency(op.companyShareAmount, op.currency || 'SYP')}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {operations.length > 45 && (
                    <tr className="bg-amber-50 text-amber-900 font-bold">
                      <td colSpan={8} className="p-2 text-center text-[10px]">
                        + تم تضمين {operations.length - 45} عملية إضافية في هذا الكشف (مدرجة بالكامل في النظام المركزي لسند المقاصة رقم {voucher.voucherNumber}).
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-black text-slate-900">
                    <td colSpan={5} className="p-2 text-right">
                      المجموع الإجمالي للعمليات:
                    </td>
                    <td className="p-2 text-left font-mono text-xs">
                      {formatCurrency(totalGrossSyp, 'SYP')}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-rose-700">
                      {formatCurrency(totalCommissionSyp, 'SYP')}
                    </td>
                    <td className="p-2 text-left font-mono text-xs text-emerald-900">
                      {formatCurrency(netPayableSyp, 'SYP')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 5. NOTES & DIRECTIVES (Without signatures per user request) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>ملاحظات وإرشادات التوثيق المالي:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-600">
              <li>
                يُعتبر هذا الكشف وثيقة تسوية ومقاصة قطعية ونهائية بين إدارة الشركة والوكيل المذكور عن الفترة المحددة.
              </li>
              <li>
                يقوم الوكيل بطباعة نسختين من هذا الملخص؛ نسخة تُرفق داخل مظروف المبلغ النقدي أو إشعار الحوالة المسلم للإدارة، ونسخة تُحفظ في أرشيف الوكيل.
              </li>
              <li>
                {voucher.description || 'تم التدقيق والمطابقة وتوليد السند عبر نظام الحسابات المركزي التلقائي.'}
              </li>
            </ul>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 6. DOCUMENT FOOTER (NO SIGNATURES PER USER DIRECTIVE)     */}
        {/* ========================================================= */}
        <div className="mt-4 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <strong className="text-slate-700">مستند إلكتروني معتمد رقمياً</strong> (لا يتطلب توقيعاً يدوياً)
            </span>
            <span>•</span>
            <span>المحاسب المسؤول: <strong className="text-slate-700">{accountantUser?.name || 'النظام المركزي'}</strong></span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span>تاريخ ووقت الإصدار: {printedAt}</span>
            <span>•</span>
            <span>كود المطابقة: CLR-REF-{voucher.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
