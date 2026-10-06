import { Parcel, Currency, PaymentType } from '../types';

export interface ParcelReceivableBreakdown {
  freightDue: number;
  codDue: number;
  transferFeeDue: number;
  totalCodDue: number;
  totalReceivable: number;
  currency: Currency;
  freightCurrency: Currency;
  codCurrency: Currency;
  transferFeeCurrency: Currency;
  isSameCurrency: boolean;
  isPrepaidWithoutCod: boolean;
  requiredSyp: number;
  requiredUsd: number;
  summaryText: string;
}

export interface ParcelPaymentSummary {
  normalizedType: 'prepaid' | 'collect' | 'cod';
  typeBadgeText: string;
  typeBadgeClass: string;
  statusText: string;
  statusBadgeClass: string;
  shippingCost: number;
  shippingCurrency: Currency;
  shippingPayer: 'sender' | 'recipient';
  shippingPayerText: string;
  isShippingPrepaidBySender: boolean;
  codAmount: number;
  codCurrency: Currency;
  transferFee: number;
  totalCodDue: number;
  isSameCurrency: boolean;
  totalDueFromRecipient: number;
  totalDueCurrency: Currency;
  requiredSyp: number;
  requiredUsd: number;
  isFullySettledAtOrigin: boolean;
  summaryDueText: string;
}

/**
 * Normalizes any parcel payment type representation (handles undefined, casing, legacy codes, Arabic text)
 */
export function normalizeParcelPaymentType(parcel: Partial<Parcel>): 'prepaid' | 'collect' | 'cod' {
  const rawType = String(parcel.paymentType || '').toLowerCase().trim();
  const hasCodAmount = Number(parcel.codAmount || 0) > 0;

  // 1. Explicit COD or positive COD amount
  if (
    rawType === 'cod' ||
    rawType === 'cod_destination' ||
    rawType.includes('ضد الدفع') ||
    rawType.includes('حوالة') ||
    rawType.includes('تحصيل بالوجهة') ||
    hasCodAmount
  ) {
    return 'cod';
  }

  // 2. Explicit Collect or due on delivery
  if (
    rawType === 'collect' ||
    rawType.includes('على المستلم') ||
    rawType.includes('تحصيل') ||
    rawType.includes('postpaid') ||
    rawType.includes('unpaid')
  ) {
    return 'collect';
  }

  // 3. Explicit Prepaid
  if (
    rawType === 'prepaid' ||
    rawType.includes('سلف') ||
    rawType.includes('مدفوع') ||
    rawType.includes('paid')
  ) {
    return 'prepaid';
  }

  // 4. Inferred from remaining dues if paymentType was missing/corrupted
  if (Number(parcel.totalDue || 0) > 0 && !hasCodAmount) {
    return 'collect';
  }

  return 'prepaid';
}

/**
 * Provides an exhaustive, highly accurate payment summary and settlement status for any parcel.
 * Used during manifest generation, parcel auditing, tracking, and receipts.
 */
export function getParcelPaymentSummary(parcel: Parcel): ParcelPaymentSummary {
  const normalizedType = normalizeParcelPaymentType(parcel);
  const shippingCost = Number(parcel.shippingCost || 0);
  const codAmount = Number(parcel.codAmount || 0);
  const transferFee = Number(parcel.transferFee || 0);
  const shippingCurrency = (parcel.shippingCurrency || parcel.currency || 'SYP') as Currency;
  const codCurrency = (parcel.codCurrency || parcel.currency || 'SYP') as Currency;
  const isSameCurrency = shippingCurrency === codCurrency;
  const totalCodDue = codAmount + transferFee;

  if (normalizedType === 'cod') {
    const isSenderShipping = parcel.codShippingPayer === 'sender';
    
    // Calculate required amounts by currency independently
    let requiredSyp = 0;
    let requiredUsd = 0;

    if (!isSenderShipping) {
      if (shippingCurrency === 'SYP') requiredSyp += shippingCost;
      else requiredUsd += shippingCost;
    }

    if (codCurrency === 'SYP') requiredSyp += totalCodDue;
    else requiredUsd += totalCodDue;

    const totalDueFromRecipient = isSenderShipping
      ? totalCodDue
      : isSameCurrency
      ? shippingCost + totalCodDue
      : totalCodDue;

    let summaryDueText = '';
    if (requiredSyp > 0 && requiredUsd > 0) {
      if (isSenderShipping) {
        summaryDueText = `${totalCodDue.toLocaleString('en-US')} ${codCurrency === 'USD' ? '$' : 'ل.س'} (حوالة)`;
      } else if (shippingCurrency === 'SYP' && codCurrency === 'USD') {
        summaryDueText = `${shippingCost.toLocaleString('en-US')} ل.س (شحن) + ${totalCodDue.toLocaleString('en-US')} $ (حوالة)`;
      } else if (shippingCurrency === 'USD' && codCurrency === 'SYP') {
        summaryDueText = `${shippingCost.toLocaleString('en-US')} $ (شحن) + ${totalCodDue.toLocaleString('en-US')} ل.س (حوالة)`;
      } else {
        summaryDueText = `${requiredSyp.toLocaleString('en-US')} ل.س + ${requiredUsd.toLocaleString('en-US')} $`;
      }
    } else if (requiredSyp > 0) {
      summaryDueText = `${requiredSyp.toLocaleString('en-US')} ل.س`;
    } else if (requiredUsd > 0) {
      summaryDueText = `${requiredUsd.toLocaleString('en-US')} $`;
    } else {
      summaryDueText = '0';
    }

    return {
      normalizedType: 'cod',
      typeBadgeText: parcel.paymentType === 'cod_destination' ? 'تحصيل بالوجهة' : 'ضد الدفع (COD)',
      typeBadgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      statusText: isSenderShipping
        ? 'الشحن مسدد سلفاً • مطلوب تحصيل COD'
        : isSameCurrency
        ? 'غير مسدد • مطلوب تحصيل الشحن وCOD'
        : 'غير مسدد • مطلوب تحصيل الشحن وCOD (عملتان مستقلتان)',
      statusBadgeClass: isSenderShipping
        ? 'bg-amber-950/60 text-amber-300 border border-amber-600/50'
        : 'bg-rose-950/60 text-rose-300 border border-rose-600/50',
      shippingCost,
      shippingCurrency,
      shippingPayer: isSenderShipping ? 'sender' : 'recipient',
      shippingPayerText: isSenderShipping ? 'مسددة من المرسل بالفرع' : 'على المستلم عند التسليم',
      isShippingPrepaidBySender: isSenderShipping,
      codAmount,
      codCurrency,
      transferFee,
      totalCodDue,
      isSameCurrency,
      totalDueFromRecipient,
      totalDueCurrency: codCurrency,
      requiredSyp,
      requiredUsd,
      isFullySettledAtOrigin: false,
      summaryDueText,
    };
  }

  if (normalizedType === 'collect') {
    const totalDueFromRecipient = parcel.totalDue && parcel.totalDue > 0 ? parcel.totalDue : shippingCost;
    const requiredSyp = shippingCurrency === 'SYP' ? totalDueFromRecipient : 0;
    const requiredUsd = shippingCurrency === 'USD' ? totalDueFromRecipient : 0;
    const summaryDueText = `${totalDueFromRecipient.toLocaleString('en-US')} ${shippingCurrency === 'SYP' ? 'ل.س' : '$'}`;

    return {
      normalizedType: 'collect',
      typeBadgeText: 'على المستلم (Collect)',
      typeBadgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
      statusText: 'غير مسدد • مطلوب تحصيل أجور الشحن عند التسليم',
      statusBadgeClass: 'bg-sky-950/60 text-sky-300 border border-sky-600/50',
      shippingCost,
      shippingCurrency,
      shippingPayer: 'recipient',
      shippingPayerText: 'على المستلم عند التسليم',
      isShippingPrepaidBySender: false,
      codAmount: 0,
      codCurrency,
      transferFee: 0,
      totalCodDue: 0,
      isSameCurrency: true,
      totalDueFromRecipient,
      totalDueCurrency: shippingCurrency,
      requiredSyp,
      requiredUsd,
      isFullySettledAtOrigin: false,
      summaryDueText,
    };
  }

  // Prepaid
  return {
    normalizedType: 'prepaid',
    typeBadgeText: 'مدفوع سلفاً (Prepaid)',
    typeBadgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    statusText: 'مسدد بالكامل في مركز الانطلاق • المطلوب: 0',
    statusBadgeClass: 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/50',
    shippingCost,
    shippingCurrency,
    shippingPayer: 'sender',
    shippingPayerText: 'مسددة بالكامل من المرسل',
    isShippingPrepaidBySender: true,
    codAmount: 0,
    codCurrency,
    transferFee: 0,
    totalCodDue: 0,
    isSameCurrency: true,
    totalDueFromRecipient: 0,
    totalDueCurrency: shippingCurrency,
    requiredSyp: 0,
    requiredUsd: 0,
    isFullySettledAtOrigin: true,
    summaryDueText: '0 (مدفوع سلفاً)',
  };
}

/**
 * Calculates the exact receivable breakdown for a parcel when delivered to recipient.
 * Ensures complete accounting accuracy across freight fees, COD merchandise value,
 * and money transfer fees, treating currencies 100% independently.
 */
export function calculateParcelReceivable(parcel: Parcel): ParcelReceivableBreakdown {
  const currency = (parcel.currency as Currency) || 'SYP';
  const freightCurrency = (parcel.shippingCurrency || parcel.currency || 'SYP') as Currency;
  const codCurrency = (parcel.codCurrency || parcel.currency || 'SYP') as Currency;
  const transferFeeCurrency = (parcel.transferFeeCurrency || parcel.codCurrency || parcel.currency || 'SYP') as Currency;
  const normalizedType = normalizeParcelPaymentType(parcel);

  // 1. Freight / Shipping Cost:
  let freightDue = 0;
  if (
    normalizedType === 'collect' ||
    (normalizedType === 'cod' && parcel.codShippingPayer !== 'sender')
  ) {
    freightDue = parcel.shippingCost || parcel.priceSyp || (normalizedType === 'collect' ? (parcel.totalDue || 0) : 0) || 0;
  }

  // 2. COD Goods Value (ثمن البضاعة):
  let codDue = 0;
  if (normalizedType === 'cod' || (parcel.codAmount && parcel.codAmount > 0)) {
    codDue = parcel.codAmount || 0;
  }

  // 3. Transfer Fee (عمولة الحوالة المالية المقيدة):
  let transferFeeDue = 0;
  if ((normalizedType === 'cod' || codDue > 0) && parcel.transferFee && parcel.transferFee > 0) {
    transferFeeDue = parcel.transferFee;
  }

  const totalCodDue = codDue + transferFeeDue;
  const isSameCurrency = freightCurrency === codCurrency;

  let requiredSyp = 0;
  let requiredUsd = 0;

  if (freightDue > 0) {
    if (freightCurrency === 'SYP') requiredSyp += freightDue;
    else requiredUsd += freightDue;
  }

  if (totalCodDue > 0) {
    if (codCurrency === 'SYP') requiredSyp += totalCodDue;
    else requiredUsd += totalCodDue;
  }

  let totalReceivable = 0;
  if (isSameCurrency) {
    totalReceivable = freightDue + totalCodDue;
  } else {
    // When different currencies, do NOT sum them together
    totalReceivable = 0;
  }

  return {
    freightDue,
    codDue,
    transferFeeDue,
    totalCodDue,
    totalReceivable,
    currency,
    freightCurrency,
    codCurrency,
    transferFeeCurrency,
    isSameCurrency,
    isPrepaidWithoutCod: normalizedType === 'prepaid' && codDue === 0,
    requiredSyp,
    requiredUsd,
    summaryText: requiredSyp > 0 && requiredUsd > 0
      ? `${requiredSyp.toLocaleString('en-US')} ل.س + ${requiredUsd.toLocaleString('en-US')} $`
      : requiredSyp > 0
      ? `${requiredSyp.toLocaleString('en-US')} ل.س`
      : requiredUsd > 0
      ? `${requiredUsd.toLocaleString('en-US')} $`
      : '0',
  };
}

