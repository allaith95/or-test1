import { Currency, PaymentType } from '../types';

export interface FinancialSummaryInput {
  paymentType: PaymentType;
  currency: Currency;
  codCurrency?: Currency;
  shippingCost: number;
  codAmount: number;
  codShippingPayer?: 'recipient' | 'sender';
  calculateTransferFee?: (amount: number, curr: Currency) => number;
}

export interface FinancialSummaryResult {
  shippingCost: number;
  codAmount: number;
  transferFee: number;
  netCodWithFee: number;
  totalDueFromReceiver: number;
  prepaidFromSender: number;
  isMultiCurrency: boolean;
  currencySummaryLabel: string;
}

/**
 * Shared, authoritative financial calculation engine for parcels.
 * Unifies financial logic between General App (ParcelIntakeView) and Courier Mobile App (CourierMobileIntake).
 */
export function computeParcelFinancialSummary(input: FinancialSummaryInput): FinancialSummaryResult {
  const {
    paymentType,
    currency,
    codCurrency = currency,
    shippingCost,
    codAmount,
    codShippingPayer = 'recipient',
    calculateTransferFee,
  } = input;

  const ship = Math.max(0, Number(shippingCost) || 0);
  const cod = paymentType === 'cod' ? Math.max(0, Number(codAmount) || 0) : 0;
  const transferFee =
    paymentType === 'cod' && cod > 0 && calculateTransferFee
      ? Math.max(0, calculateTransferFee(cod, codCurrency))
      : 0;

  const netCodWithFee = cod + transferFee;
  const isMultiCurrency = paymentType === 'cod' && currency !== codCurrency;

  let totalDueFromReceiver = 0;
  let prepaidFromSender = 0;

  if (paymentType === 'prepaid') {
    totalDueFromReceiver = 0;
    prepaidFromSender = ship;
  } else if (paymentType === 'collect') {
    totalDueFromReceiver = ship;
    prepaidFromSender = 0;
  } else if (paymentType === 'cod') {
    if (codShippingPayer === 'sender') {
      // أجور الشحن مسددة من المرسل سلفاً، والمطلوب تحصيله من المستلم هو صافي الحوالة مع عمولتها فقط
      totalDueFromReceiver = netCodWithFee;
      prepaidFromSender = ship;
    } else if (currency === codCurrency) {
      // عملة موحدة: المستلم يسدد أجور الشحن + الحوالة + عمولتها
      totalDueFromReceiver = ship + netCodWithFee;
      prepaidFromSender = 0;
    } else {
      // عملتان مختلفتان: صافي الحوالة بعملتها كـ totalDue للحوالة، وتبقى أجور الشحن بعملتها المنفصلة
      totalDueFromReceiver = netCodWithFee;
      prepaidFromSender = 0;
    }
  }

  return {
    shippingCost: ship,
    codAmount: cod,
    transferFee,
    netCodWithFee,
    totalDueFromReceiver,
    prepaidFromSender,
    isMultiCurrency,
    currencySummaryLabel: isMultiCurrency ? 'عملتان مختلفتان (شحن + حوالة)' : 'عملة موحدة',
  };
}
