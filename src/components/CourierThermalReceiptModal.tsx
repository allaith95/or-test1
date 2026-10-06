import React, { useState, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Parcel } from '../types';
import {
  Printer,
  X,
  Bluetooth,
  Share2,
  Copy,
  Check,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { WaybillBarcode } from './WaybillBarcode';
import { WaybillQRCode } from './WaybillQRCode';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import { safePrint } from '../utils/storage';

interface CourierThermalReceiptModalProps {
  parcel: Parcel | null;
  isOpen: boolean;
  onClose: () => void;
  autoConnectBluetooth?: boolean;
}

export const CourierThermalReceiptModal: React.FC<CourierThermalReceiptModalProps> = ({
  parcel,
  isOpen,
  onClose,
  autoConnectBluetooth = false,
}) => {
  const { currentBranch, branches, currentUser, formatCurrency, brandingSettings } = useOrca();

  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error' | 'unsupported'
  >('idle');
  const [bluetoothErrorMsg, setBluetoothErrorMsg] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Auto trigger Bluetooth on open if requested
  React.useEffect(() => {
    if (isOpen && autoConnectBluetooth && 'bluetooth' in navigator) {
      const timer = setTimeout(() => {
        handleBluetoothDirectPrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoConnectBluetooth]);

  if (!isOpen || !parcel) return null;

  const originBranch = branches.find((b) => b.id === parcel.originHubId) || currentBranch;
  const destBranch = branches.find((b) => b.id === parcel.destinationHubId);

  const trackingUrl = `${window.location.origin}/?track=${parcel.trackingNumber}`;

  // Formatted Payment Label
  const paymentTypeLabel =
    parcel.paymentType === 'prepaid'
      ? 'مدفوع سلفاً (Prepaid)'
      : parcel.paymentType === 'cod'
      ? 'ضد الدفع (COD)'
      : 'على المستلم (Collect)';

  // Native Browser Thermal Print (Optimized CSS @media print for 80mm/58mm via index.css)
  const handlePrintThermal = () => {
    setIsPrinting(true);
    const mode = paperWidth === '58mm' ? 'thermal-58' : 'thermal';
    safePrint(mode);
    setIsPrinting(false);
  };

  // Direct Web Bluetooth ESC/POS Printing
  const handleBluetoothDirectPrint = async () => {
    if (!('bluetooth' in navigator)) {
      setBluetoothStatus('unsupported');
      setBluetoothErrorMsg('متصفحك لا يدعم Web Bluetooth، يرجى استخدام زر "الطباعة الحرارية الفورية".');
      return;
    }

    try {
      setBluetoothStatus('connecting');
      setBluetoothErrorMsg('');

      // Standard Bluetooth Thermal Printer GATT Services
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error('فشل الاتصال بالطابعة عبر البلوتوث.');

      // Try discovering common printer characteristics
      let printerCharacteristic: any = null;
      try {
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristics = await service.getCharacteristics();
        printerCharacteristic = characteristics[0];
      } catch {
        // Fallback: try first available write characteristic
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const chars = await s.getCharacteristics();
          const writable = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          if (writable) {
            printerCharacteristic = writable;
            break;
          }
        }
      }

      if (!printerCharacteristic) {
        throw new Error('لم يتم العثور على قناة إرسال البيانات للطابعة.');
      }

      // Build ESC/POS text command payload
      const encoder = new TextEncoder();
      const escInit = new Uint8Array([0x1b, 0x40]); // ESC @ Initialize
      const escAlignCenter = new Uint8Array([0x1b, 0x61, 0x01]); // Center
      const escAlignRight = new Uint8Array([0x1b, 0x61, 0x02]); // Right
      const escDoubleSize = new Uint8Array([0x1d, 0x21, 0x11]); // Double height & width
      const escNormalSize = new Uint8Array([0x1d, 0x21, 0x00]); // Normal
      const escFeedCut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]); // Feed & Cut

      const textHeader = `\nORCA EXPRESS LOGISTICS\nبوليصة شحن: ${parcel.trackingNumber}\nالتاريخ: ${new Date().toLocaleDateString('ar-SY')}\nالموزع: ${currentUser.name}\n================================\n`;
      const textSender = `المرسل: ${parcel.sender.name}\nهاتف: ${parcel.sender.phone}\nمدينة: ${parcel.sender.city}\n--------------------------------\n`;
      const textReceiver = `المستلم: ${parcel.receiver.name}\nهاتف: ${parcel.receiver.phone}\nالوجهة: ${destBranch?.name || parcel.receiver.city}\nالعنوان: ${parcel.destinationAddress || parcel.receiver.address || ''}\n--------------------------------\n`;
      const textPackage = `النوع: ${parcel.packageType} | قطع: ${parcel.piecesCount}\nالوزن: ${parcel.weightKg} كغ\n================================\n`;
      const textFinance = `طريقة الدفع: ${paymentTypeLabel}\nأجرة الشحن: ${parcel.shippingCost} ${parcel.currency}\nالمطلوب تحصيله: ${parcel.totalDue} ${parcel.currency}\n================================\n`;
      const textFooter = `تتبع بوليصتك عبر:\n${trackingUrl}\nشكراً لتعاملكم مع أوركا إكسبريس\n\n\n`;

      // Write sequential chunks to avoid buffer overrun
      await printerCharacteristic.writeValue(escInit);
      await printerCharacteristic.writeValue(escAlignCenter);
      await printerCharacteristic.writeValue(encoder.encode(textHeader));
      await printerCharacteristic.writeValue(escAlignRight);
      await printerCharacteristic.writeValue(encoder.encode(textSender + textReceiver + textPackage));
      await printerCharacteristic.writeValue(escAlignCenter);
      await printerCharacteristic.writeValue(escDoubleSize);
      await printerCharacteristic.writeValue(encoder.encode(`المجموع: ${parcel.totalDue} ${parcel.currency}\n`));
      await printerCharacteristic.writeValue(escNormalSize);
      await printerCharacteristic.writeValue(encoder.encode(textFinance + textFooter));
      await printerCharacteristic.writeValue(escFeedCut);

      setBluetoothStatus('connected');
      setTimeout(() => setBluetoothStatus('idle'), 3000);
    } catch (err: any) {
      console.warn('Direct Bluetooth thermal print note:', err);
      setBluetoothStatus('error');
      setBluetoothErrorMsg(err.message || 'تعذر الاتصال المباشر. يمكنك استخدام الطباعة الحرارية الفورية عبر المتصفح.');
    }
  };

  // WhatsApp Share Helper
  const handleShareWhatsApp = () => {
    if (!parcel) return;
    const summary = getParcelPaymentSummary(parcel);
    const destCity = destBranch?.city || parcel.receiver.city || 'الفرع';
    const msg = `*أوركا إكسبريس للشحن السريع*\n📦 *إيصال شحنة بريّة*\nرقم البوليصة: ${parcel.trackingNumber}\nالمرسل: ${parcel.sender.name}\nالمستلم: ${parcel.receiver.name}\nالوجهة: ${destCity}\n💵 المطلوب تحصيله: ${summary.summaryDueText}\nتتبع شحنتك لحظياً: ${trackingUrl}`;
    const cleanPhone = (parcel.sender.phone || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone.startsWith('0') ? '963' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Copy Summary
  const handleCopySummary = () => {
    if (!navigator?.clipboard || !parcel) return;
    const summary = getParcelPaymentSummary(parcel);
    const txt = `أوركا إكسبريس | بوليصة: ${parcel.trackingNumber} | المرسل: ${parcel.sender.name} | المستلم: ${parcel.receiver.name} | المبلغ: ${summary.summaryDueText}`;
    navigator.clipboard.writeText(txt);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 my-auto max-h-[95vh] flex flex-col font-['Cairo',sans-serif]"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                  <span>الطباعة الحرارية المباشرة</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                    Direct Thermal
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  مخصصة لطابعات البلوتوث والمحمولة للموزعين (58mm / 80mm)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions & Settings Bar */}
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold">عرض الرول:</span>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  paperWidth === '58mm'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                58mm (جيب)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  paperWidth === '80mm'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                80mm (قياسي)
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopySummary}
                className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-lg border border-slate-800 transition cursor-pointer"
                title="نسخ ملخص البوليصة"
              >
                {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg border border-emerald-500/30 transition cursor-pointer"
                title="مشاركة عبر واتساب"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bluetooth Status Alert if present */}
          {bluetoothStatus === 'connecting' && (
            <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 flex items-center gap-2 animate-pulse">
              <Bluetooth className="w-4 h-4 animate-spin" />
              <span>جاري البحث والاتصال بطابعة البلوتوث المحمولة...</span>
            </div>
          )}
          {bluetoothStatus === 'connected' && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>تم إرسال أوامر الطباعة بنجاح إلى طابعة البلوتوث!</span>
            </div>
          )}
          {bluetoothErrorMsg && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{bluetoothErrorMsg}</span>
            </div>
          )}

          {/* Visual Thermal Receipt Simulation Container */}
          <div className="flex-1 overflow-y-auto max-h-[55vh] p-2 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-center">
            
            {/* The Actual Printable Thermal Receipt */}
            <div
              ref={receiptRef}
              id="thermal-receipt-printable"
              className={`bg-white text-black p-3 sm:p-4 shadow-xl border border-dashed border-slate-300 rounded-lg select-text font-mono text-center text-xs transition-all ${
                paperWidth === '58mm' ? 'w-[270px]' : 'w-[340px]'
              }`}
              style={{
                fontFamily: "'Courier New', Courier, monospace, 'Cairo', sans-serif",
                color: '#000000',
                backgroundColor: '#ffffff',
              }}
              dir="rtl"
            >
              {/* Receipt Header */}
              <div className="flex flex-col items-center justify-center pb-2 border-b-2 border-black space-y-1">
                <OrcaLogo
                  monochrome
                  size={44}
                  circularBg={false}
                  customLogoUrl={brandingSettings?.printLogoUrl || brandingSettings?.logoUrl}
                />
                <h2 className="text-sm font-black tracking-wider uppercase">
                  {brandingSettings?.companyName || 'أوركا إكسبريس'}
                </h2>
                <span className="text-[10px] font-bold text-gray-800">
                  {brandingSettings?.companySubtitle || 'ORCA EXPRESS LOGISTICS'}
                </span>
                {(brandingSettings?.customerServicePhone || brandingSettings?.officialPhone) && (
                  <span className="text-[9px] text-gray-700 font-mono font-bold" dir="ltr">
                    خدمة الزبائن: {brandingSettings.customerServicePhone || brandingSettings.officialPhone}
                  </span>
                )}
              </div>

              {/* Waybill Number Barcode & QR */}
              <div className="py-2.5 border-b border-black text-center space-y-1.5">
                <span className="text-[10px] font-bold text-gray-700 block">رقم بوليصة الشحن الرسمية</span>
                <div className="flex justify-center bg-white py-1">
                  <WaybillBarcode
                    value={parcel.trackingNumber}
                    width={paperWidth === '58mm' ? 1.45 : 1.75}
                    height={38}
                    displayValue={false}
                  />
                </div>
                <div className="text-base font-black tracking-widest font-mono text-black" dir="ltr">
                  {parcel.trackingNumber}
                </div>
                {parcel.paperReceiptNumber && (
                  <span className="text-[9px] text-gray-700 block">
                    الوصل الورقي: {parcel.paperReceiptNumber}
                  </span>
                )}
              </div>

              {/* Waybill Metadata */}
              <div className="py-2 border-b border-dashed border-black text-right text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span className="font-bold">
                    {new Date(parcel.createdAt || Date.now()).toLocaleDateString('ar-SY')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>توقيت التسجيل:</span>
                  <span className="font-bold">
                    {new Date(parcel.createdAt || Date.now()).toLocaleTimeString('ar-SY', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>الموزع المسجل:</span>
                  <span className="font-bold">{currentUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>فرع المصدر:</span>
                  <span className="font-bold">{originBranch?.name || 'دمشق'}</span>
                </div>
              </div>

              {/* Sender Info */}
              <div className="py-2 border-b border-dashed border-black text-right text-[10px] space-y-1">
                <div className="font-black text-xs border-b border-gray-300 pb-0.5">
                  [1] بيانات المرسل:
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">الاسم:</span>
                  <span className="font-bold text-[11px]">{parcel.sender.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">الهاتف:</span>
                  <span className="font-bold" dir="ltr">{parcel.sender.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">المدينة / العنوان:</span>
                  <span>{parcel.sender.city} {parcel.sender.address ? `(${parcel.sender.address})` : ''}</span>
                </div>
                {parcel.sender.nationalId && (
                  <div className="flex justify-between text-[9px] text-gray-700">
                    <span>الرقم الوطني:</span>
                    <span className="font-mono">{parcel.sender.nationalId}</span>
                  </div>
                )}
              </div>

              {/* Receiver Info */}
              <div className="py-2 border-b border-black text-right text-[10px] space-y-1">
                <div className="font-black text-xs border-b border-gray-300 pb-0.5">
                  [2] بيانات المستلم والوجهة:
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">الاسم:</span>
                  <span className="font-bold text-[11px]">{parcel.receiver.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">الهاتف:</span>
                  <span className="font-bold" dir="ltr">{parcel.receiver.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">فرع الوجهة:</span>
                  <span className="font-bold">{destBranch?.name || parcel.receiver.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">عنوان التسليم:</span>
                  <span>{parcel.destinationAddress || parcel.receiver.address || 'مركز الفرع'}</span>
                </div>
              </div>

              {/* Parcel Specs */}
              <div className="py-2 border-b border-dashed border-black text-right text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>نوع الطرد:</span>
                  <span className="font-bold">{parcel.packageType}</span>
                </div>
                <div className="flex justify-between">
                  <span>القطع / الوزن:</span>
                  <span className="font-bold">{parcel.piecesCount} قطعة / {parcel.weightKg} كغ</span>
                </div>
                {parcel.contentDescription && (
                  <div className="text-[9px] text-gray-800">
                    <span>الوصف: </span>
                    <span>{parcel.contentDescription}</span>
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="py-2.5 border-b-2 border-black text-right text-[10px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-bold">طريقة الدفع:</span>
                  <span className="font-black">{paymentTypeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>أجور الشحن {parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender' ? '(مسددة من المرسل):' : ':'}</span>
                  <span className="font-bold">{formatCurrency(parcel.shippingCost, parcel.shippingCurrency || parcel.currency || 'SYP')}</span>
                </div>
                {parcel.codAmount > 0 && (
                  <div className="flex justify-between text-black font-bold">
                    <span>قيمة البضاعة (COD):</span>
                    <span>{formatCurrency(parcel.codAmount, parcel.codCurrency || parcel.currency || 'SYP')}</span>
                  </div>
                )}
                {parcel.transferFee > 0 && (
                  <div className="flex justify-between text-[9px] text-gray-700">
                    <span>عمولة الحوالة:</span>
                    <span>{formatCurrency(parcel.transferFee, parcel.transferFeeCurrency || parcel.codCurrency || parcel.currency || 'SYP')}</span>
                  </div>
                )}

                {/* Big Highlighted Total Box */}
                <div className="mt-2 p-2 border-2 border-black text-center space-y-0.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-800 block">
                    {parcel.paymentType === 'prepaid' ? 'المبلغ المستوفى من المرسل:' : 'المطلوب تحصيله من المستلم:'}
                  </span>
                  <span className="text-sm sm:text-base font-black tracking-wider block">
                    {getParcelPaymentSummary(parcel).summaryDueText}
                  </span>
                </div>
              </div>

              {/* QR Code Tracking Box */}
              <div className="py-2 text-center flex flex-col items-center justify-center space-y-1 border-b border-dashed border-black">
                <WaybillQRCode value={trackingUrl} size={paperWidth === '58mm' ? 80 : 95} />
                <span className="text-[8px] text-gray-700">امسح رمز الاستجابة السريع لتتبع الشحنة</span>
              </div>

              {/* Courier Tear-off Stub */}
              <div className="pt-2 text-right text-[9px] space-y-1">
                <div className="flex items-center justify-center gap-1 text-[8px] font-mono text-gray-600 my-1">
                  <Scissors className="w-3 h-3 rotate-90" />
                  <span>- - - - - قص هنا (كعب الموزع) - - - - -</span>
                </div>
                <div className="flex justify-between font-bold text-[10px]">
                  <span>بوليصة: {parcel.trackingNumber}</span>
                  <span className="text-[9px]">{getParcelPaymentSummary(parcel).summaryDueText}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span>المرسل: {parcel.sender.name.slice(0, 16)}</span>
                  <span>المستلم: {parcel.receiver.name.slice(0, 16)}</span>
                </div>
                <div className="pt-2 pb-1 border-b border-dotted border-black flex justify-between items-end">
                  <span className="text-[8px] text-gray-700">توقيع المستلم / العميل:</span>
                  <span className="text-[8px] font-mono text-gray-400">........................</span>
                </div>
                <div className="text-[8px] text-center text-gray-600 pt-1">
                  شكراً لاختياركم {brandingSettings?.companyName || 'أوركا إكسبريس'}
                  {brandingSettings?.customerServicePhone ? ` • خدمة الزبائن: ${brandingSettings.customerServicePhone}` : ''}
                </div>
              </div>

            </div>

          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handlePrintThermal}
              disabled={isPrinting}
              className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>طباعة حرارية فورية ({paperWidth})</span>
            </button>

            {/* Direct Bluetooth ESC/POS Button */}
            <button
              type="button"
              onClick={handleBluetoothDirectPrint}
              disabled={bluetoothStatus === 'connecting'}
              className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-md"
            >
              <Bluetooth className={`w-4 h-4 ${bluetoothStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span>إرسال لطابعة البلوتوث المباشرة</span>
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer py-1"
            >
              إغلاق النافذة
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
