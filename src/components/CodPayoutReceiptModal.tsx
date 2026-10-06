import React, { useRef } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import type { Parcel, Branch } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  parcel: Parcel | null;
  branch?: Branch | null;
  formatCurrency: (amount: number, currency: string) => string;
}

export const CodPayoutReceiptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  parcel,
  branch,
  formatCurrency,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !parcel) return null;

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>إيصال صرف حوالة COD - ${parcel.trackingNumber}</title>
        <style>
          @page { size: A5 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Cairo', 'Segoe UI', sans-serif;
            margin: 0;
            padding: 0;
            color: #000;
            direction: rtl;
          }
          .receipt {
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
            padding: 15px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 900;
          }
          .header .subtitle {
            font-size: 12px;
            margin-top: 4px;
          }
          .voucher-badge {
            background: #000;
            color: #fff;
            padding: 8px 12px;
            text-align: center;
            font-size: 14px;
            font-weight: 900;
            margin: 10px 0;
            border-radius: 4px;
          }
          .section {
            margin: 10px 0;
            padding: 8px;
            border: 1px solid #000;
            border-radius: 4px;
          }
          .section-title {
            font-size: 11px;
            font-weight: 900;
            background: #f0f0f0;
            margin: -8px -8px 6px -8px;
            padding: 4px 8px;
            border-bottom: 1px solid #000;
          }
          .field {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 11px;
            border-bottom: 1px dotted #999;
          }
          .field:last-child { border-bottom: none; }
          .field-label { font-weight: 700; color: #333; }
          .field-value { font-weight: 900; font-family: monospace; }
          .amount-box {
            text-align: center;
            padding: 12px;
            background: #f5f5f5;
            border: 2px solid #000;
            border-radius: 6px;
            margin: 12px 0;
          }
          .amount-value {
            font-size: 22px;
            font-weight: 900;
            font-family: monospace;
            margin: 4px 0;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px dashed #000;
          }
          .signature-box {
            text-align: center;
            padding-top: 30px;
            border-top: 1px solid #000;
            font-size: 10px;
          }
          .footer-note {
            text-align: center;
            font-size: 9px;
            color: #666;
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
          }
        </style>
      </head>
      <body>
        ${printContents}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };

  const voucherNumber = parcel.codSenderPayoutVoucherNumber || '—';
  const payoutDate = parcel.codSenderPayoutDate 
    ? new Date(parcel.codSenderPayoutDate) 
    : new Date();
  const payoutAmount = parcel.codSenderPayoutAmountSyp || parcel.codAmount || 0;
  const payoutCurrency = (parcel as any).codSenderPayoutCurrency || parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency || 'SYP');

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Controls */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-black text-sm">إيصال صرف حوالة COD</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content (printable area) */}
        <div className="flex-1 overflow-y-auto bg-white p-4" dir="rtl">
          <div ref={printRef} className="receipt">
            
            <div className="header">
              <h1>شركة أوركا إكسبريس</h1>
              <div className="subtitle">منظومة الشحن البري والخدمات اللوجستية</div>
              <div className="subtitle">إيصال صرف حوالة ضد الدفع (COD)</div>
            </div>

            <div className="voucher-badge">
              سند رقم: {voucherNumber}
            </div>

            <div className="section">
              <div className="section-title">معلومات العملية</div>
              <div className="field">
                <span className="field-label">التاريخ:</span>
                <span className="field-value">
                  {payoutDate.toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="field">
                <span className="field-label">الوقت:</span>
                <span className="field-value">
                  {payoutDate.toLocaleTimeString('ar-SY')}
                </span>
              </div>
              <div className="field">
                <span className="field-label">الفرع:</span>
                <span className="field-value">{branch?.name || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">الموظف المنفذ:</span>
                <span className="field-value">
                  {parcel.codSenderPayoutByUserName || '—'}
                </span>
              </div>
            </div>

            <div className="section">
              <div className="section-title">بيانات المرسل (المستفيد)</div>
              <div className="field">
                <span className="field-label">الاسم:</span>
                <span className="field-value">{parcel.sender?.name || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">الهاتف:</span>
                <span className="field-value">{parcel.sender?.phone || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">الرقم الوطني:</span>
                <span className="field-value">
                  {parcel.codSenderRecipientNationalId || 
                   parcel.sender?.nationalId || '—'}
                </span>
              </div>
            </div>

            <div className="section">
              <div className="section-title">بيانات البوليصة</div>
              <div className="field">
                <span className="field-label">رقم البوليصة:</span>
                <span className="field-value">{parcel.trackingNumber}</span>
              </div>
              <div className="field">
                <span className="field-label">المستلم الأصلي:</span>
                <span className="field-value">{parcel.receiver?.name || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">هاتف المستلم:</span>
                <span className="field-value">{parcel.receiver?.phone || '—'}</span>
              </div>
            </div>

            <div className="amount-box">
              <div className="field-label">المبلغ المصروف</div>
              <div className="amount-value">
                {payoutAmount.toLocaleString('en-US')} {payoutCurrency}
              </div>
            </div>

            <div className="signatures">
              <div className="signature-box">
                توقيع المستفيد
              </div>
              <div className="signature-box">
                توقيع الموظف المنفذ
              </div>
            </div>

            <div className="footer-note">
              هذا الإيصال يُثبت صرف حوالة COD للمرسل الأصلي.
              يجب الاحتفاظ به في دفاتر الشركة.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
