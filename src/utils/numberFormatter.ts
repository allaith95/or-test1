import { NumberFormatSettings, DigitStyle, ThousandsSeparator, DecimalSeparator, Currency } from '../types';

export const DEFAULT_NUMBER_FORMAT_SETTINGS: NumberFormatSettings = {
  digitStyle: 'latin', // 'latin' (123) أو 'arabic_indic' (١٢٣)
  thousandsSeparator: 'comma', // 'comma' (,) | 'dot' (.) | 'space' ( ) | 'none' ()
  decimalSeparator: 'dot', // 'dot' (.) | 'comma' (,) | 'arabic_comma' (٫)
  sypDecimals: 0, // الليرة السورية بدون أجزاء افتراضياً
  usdDecimals: 2, // الدولار الأمريكي خانتان
  quantityDecimals: 0, // عدد الطرود والكميات
  weightDecimals: 2, // الأوزان كغ والأحجام
  hideTrailingZeros: true, // إخفاء الأصفار العشرية غير الضرورية (مثل 15 بدلاً من 15.00)
  compactLargeNumbers: false, // اختصار الأرقام الكبيرة (مثل 1.2M أو 250K)
  currencyPosition: 'suffix', // رمز العملة بعد الرقم (15,000 ل.س)
};

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * تحويل الأرقام المشرقية/العربية والفارسية إلى أرقام لاتينية (0-9)
 */
export function toLatinDigits(str: any): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/**
 * تنسيق التاريخ حصراً بالأرقام اللاتينية DD/MM/YYYY
 */
export function formatLatinDate(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return toLatinDigits(String(dateStrOrObj));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
  } catch {
    return toLatinDigits(String(dateStrOrObj));
  }
}

/**
 * تنسيق الوقت بالأرقام اللاتينية HH:mm
 */
export function formatLatinTime(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return toLatinDigits(String(dateStrOrObj));
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  } catch {
    return toLatinDigits(String(dateStrOrObj));
  }
}

/**
 * تنسيق التاريخ والوقت بالأرقام اللاتينية DD/MM/YYYY HH:mm
 */
export function formatLatinDateTime(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return '';
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return toLatinDigits(String(dateStrOrObj));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${m}/${y} ${hours}:${mins}`;
  } catch {
    return toLatinDigits(String(dateStrOrObj));
  }
}

/**
 * تحويل الأرقام الإنجليزية/اللاتينية إلى أرقام عربية مشرقية (الهندية الأصلية)
 */
export function toArabicIndicDigits(str: string): string {
  return str.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[parseInt(d, 10)] || d);
}

/**
 * الحصول على محرف فاصلة الآلاف المعتمد
 */
export function getThousandsSeparatorChar(sep: ThousandsSeparator): string {
  switch (sep) {
    case 'comma':
      return ',';
    case 'dot':
      return '.';
    case 'space':
      return ' ';
    case 'apostrophe':
      return "'";
    case 'none':
      return '';
    default:
      return ',';
  }
}

/**
 * الحصول على محرف فاصلة الكسور العشرية المعتمد
 */
export function getDecimalSeparatorChar(sep: DecimalSeparator): string {
  switch (sep) {
    case 'dot':
      return '.';
    case 'comma':
      return ',';
    case 'arabic_comma':
      return '٫';
    default:
      return '.';
  }
}

export interface FormatNumberOptions {
  decimals?: number;
  hideTrailingZeros?: boolean;
  compact?: boolean;
  currency?: 'SYP' | 'USD' | Currency | string;
  currencyPosition?: 'suffix' | 'prefix';
  unit?: string;
  digitStyle?: DigitStyle;
  thousandsSeparator?: ThousandsSeparator;
  decimalSeparator?: DecimalSeparator;
  prefix?: string;
  suffix?: string;
}

/**
 * محرك التنسيق المالي والعددي الموحد للنظام
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: FormatNumberOptions,
  currentSettings?: NumberFormatSettings | null
): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) {
    return '0';
  }

  const s: NumberFormatSettings = {
    ...DEFAULT_NUMBER_FORMAT_SETTINGS,
    ...(currentSettings || {}),
  };

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // الخيارات المحسومة
  const thousandsSep = options?.thousandsSeparator ?? s.thousandsSeparator;
  const decimalSep = options?.decimalSeparator ?? s.decimalSeparator;
  const digitStyle = options?.digitStyle ?? s.digitStyle;
  const shouldCompact = options?.compact ?? s.compactLargeNumbers;
  const hideZeros = options?.hideTrailingZeros ?? s.hideTrailingZeros;

  let formattedMain = '';
  let compactSuffix = '';

  if (shouldCompact && absNum >= 1000000) {
    const millions = absNum / 1000000;
    formattedMain = millions.toFixed(1).replace(/\.0$/, '');
    compactSuffix = digitStyle === 'arabic_indic' ? ' م' : 'M';
  } else if (shouldCompact && absNum >= 10000) {
    const thousands = absNum / 1000;
    formattedMain = thousands.toFixed(1).replace(/\.0$/, '');
    compactSuffix = digitStyle === 'arabic_indic' ? ' ك' : 'K';
  } else {
    // تحديد عدد الخانات العشرية
    let decCount = s.sypDecimals;
    if (options?.decimals !== undefined) {
      decCount = options.decimals;
    } else if (options?.currency === 'USD') {
      decCount = s.usdDecimals;
    } else if (options?.currency === 'SYP') {
      decCount = s.sypDecimals;
    }

    const fixedStr = absNum.toFixed(Math.max(0, Math.min(10, decCount)));
    const parts = fixedStr.split('.');
    const integerPart = parts[0];
    let fractionPart = parts[1] || '';

    // إخفاء الأصفار العشرية عند الطلب
    if (hideZeros && fractionPart) {
      fractionPart = fractionPart.replace(/0+$/, '');
    }

    // تطبيق فاصلة الآلاف
    const thousandsChar = getThousandsSeparatorChar(thousandsSep);
    const formattedInteger = thousandsChar
      ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsChar)
      : integerPart;

    // تطبيق فاصلة الكسور العشرية
    const decimalChar = getDecimalSeparatorChar(decimalSep);
    formattedMain = fractionPart.length > 0 ? `${formattedInteger}${decimalChar}${fractionPart}` : formattedInteger;
  }

  // تحويل الأرقام إن كان المطلوب أرقام مشرقية
  if (digitStyle === 'arabic_indic') {
    formattedMain = toArabicIndicDigits(formattedMain);
  }

  if (compactSuffix) {
    formattedMain += compactSuffix;
  }

  if (isNegative) {
    formattedMain = `-${formattedMain}`;
  }

  // معالجة رموز العملة أو الوحدات
  let currencyLabel = '';
  if (options?.currency) {
    if (options.currency === 'USD') {
      currencyLabel = '$';
    } else if (options.currency === 'SYP') {
      currencyLabel = 'ل.س';
    } else {
      currencyLabel = options.currency;
    }
  }

  const pos = options?.currencyPosition ?? s.currencyPosition;

  let result = formattedMain;

  if (options?.prefix) {
    result = `${options.prefix} ${result}`;
  }

  if (currencyLabel) {
    if (pos === 'prefix') {
      result = `${currencyLabel} ${result}`;
    } else {
      result = `${result} ${currencyLabel}`;
    }
  }

  if (options?.unit) {
    result = `${result} ${options.unit}`;
  }

  if (options?.suffix) {
    result = `${result} ${options.suffix}`;
  }

  return result.trim();
}

/**
 * تنسيق مالي سريع للعملات (ليرة سورية أو دولار أمريكي)
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: 'SYP' | 'USD' | Currency | string = 'SYP',
  settings?: NumberFormatSettings | null,
  options?: FormatNumberOptions
): string {
  const isUsd = currency === 'USD';
  const dec = options?.decimals !== undefined
    ? options.decimals
    : (isUsd ? (settings?.usdDecimals ?? 2) : (settings?.sypDecimals ?? 0));

  return formatNumber(
    amount,
    {
      currency,
      decimals: dec,
      ...options,
    },
    settings
  );
}

/**
 * تنسيق كميات وعدد الطرود (بدون كسور افتراضياً)
 */
export function formatQuantity(
  qty: number | string | null | undefined,
  unit?: string,
  settings?: NumberFormatSettings | null
): string {
  const dec = settings?.quantityDecimals ?? 0;
  return formatNumber(qty, { decimals: dec, unit }, settings);
}

/**
 * تنسيق الأوزان بالكيلوغرام
 */
export function formatWeight(
  weightKg: number | string | null | undefined,
  settings?: NumberFormatSettings | null
): string {
  const dec = settings?.weightDecimals ?? 2;
  return formatNumber(weightKg, { decimals: dec, unit: 'كغ' }, settings);
}

/**
 * تنسيق الحجوم بالمتر المكعب CBM
 */
export function formatVolume(
  cbm: number | string | null | undefined,
  settings?: NumberFormatSettings | null
): string {
  const dec = settings?.weightDecimals ?? 3;
  return formatNumber(cbm, { decimals: dec, unit: 'م³' }, settings);
}

/**
 * تنسيق أسعار الصرف (مثلاً 15,000 ل.س)
 */
export function formatExchangeRate(
  rate: number | string | null | undefined,
  settings?: NumberFormatSettings | null
): string {
  return formatNumber(rate, { decimals: 0, currency: 'SYP' }, settings);
}

/**
 * تنسيق النسب المئوية (مثلاً 2.5%)
 */
export function formatPercentage(
  percent: number | string | null | undefined,
  settings?: NumberFormatSettings | null
): string {
  return formatNumber(percent, { decimals: 2, suffix: '%' }, settings);
}

/**
 * دالة التفقيط وتحويل الأرقام إلى كلمات عربية فصحى لتمييز الآحاد والآلاف والملايين
 */
const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = [
  'عشرة',
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
const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = [
  '',
  'مائة',
  'مئتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertThreeDigits(num: number): string {
  if (num === 0) return '';
  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const parts: string[] = [];

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(ONES[remainder]);
    } else if (remainder < 20) {
      parts.push(TEENS[remainder - 10]);
    } else {
      const u = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (u > 0) {
        parts.push(`${ONES[u]} و${TENS[t]}`);
      } else {
        parts.push(TENS[t]);
      }
    }
  }

  return parts.join(' و');
}

export function formatAmountInWordsArabic(
  amount: number | string | null | undefined,
  currency: 'SYP' | 'USD' | string = 'SYP'
): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, ''));
  if (isNaN(num) || num === 0) return 'صفر';

  const abs = Math.abs(num);
  const intPart = Math.floor(abs);
  const fractionPart = Math.round((abs - intPart) * 100);

  const billions = Math.floor(intPart / 1000000000);
  const millions = Math.floor((intPart % 1000000000) / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const ones = intPart % 1000;

  const resultSegments: string[] = [];

  // مليارات
  if (billions > 0) {
    if (billions === 1) resultSegments.push('مليار');
    else if (billions === 2) resultSegments.push('ملياران');
    else if (billions >= 3 && billions <= 10) resultSegments.push(`${convertThreeDigits(billions)} مليارات`);
    else resultSegments.push(`${convertThreeDigits(billions)} ملياراً`);
  }

  // ملايين
  if (millions > 0) {
    if (millions === 1) resultSegments.push('مليون');
    else if (millions === 2) resultSegments.push('مليونان');
    else if (millions >= 3 && millions <= 10) resultSegments.push(`${convertThreeDigits(millions)} ملايين`);
    else resultSegments.push(`${convertThreeDigits(millions)} مليوناً`);
  }

  // آلاف
  if (thousands > 0) {
    if (thousands === 1) resultSegments.push('ألف');
    else if (thousands === 2) resultSegments.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) resultSegments.push(`${convertThreeDigits(thousands)} آلاف`);
    else resultSegments.push(`${convertThreeDigits(thousands)} ألفاً`);
  }

  // آحاد ومئات
  if (ones > 0) {
    resultSegments.push(convertThreeDigits(ones));
  }

  let text = resultSegments.join(' و');

  // إضافة العملة
  if (currency === 'USD') {
    text += ' دولار أمريكي';
    if (fractionPart > 0) {
      text += ` و${convertThreeDigits(fractionPart)} سنتاً`;
    }
  } else if (currency === 'SYP') {
    text += ' ليرة سورية';
    if (fractionPart > 0) {
      text += ` و${convertThreeDigits(fractionPart)} قرشاً`;
    }
  } else {
    text += ` ${currency}`;
  }

  if (num < 0) {
    text = `سالب ${text}`;
  }

  return text.trim();
}

/**
 * إظهار الرقم مع فواصل الآلاف بشكل صريح ومباشر لأي حقل مالي
 */
export function formatAmountWithSeparators(
  value: number | string | null | undefined,
  currency?: string
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '0';

  const parts = String(num).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;

  if (currency) {
    const curLabel = currency === 'USD' ? '$' : currency === 'SYP' ? 'ل.س' : currency;
    return `${formatted} ${curLabel}`;
  }
  return formatted;
}
