import { Governorate, ParcelSizeTier, PricingBasis, Currency, CodTransferSettings, CodCommissionBracket } from '../types';
import { formatCurrency } from './numberFormatter';

export const ALL_SYRIAN_GOVERNORATES: Governorate[] = [
  'دمشق',
  'ريف دمشق',
  'حلب',
  'حمص',
  'حماة',
  'اللاذقية',
  'طرطوس',
  'إدلب',
  'درعا',
  'السويداء',
  'القنيطرة',
  'دير الزور',
  'الرقة',
  'الحسكة',
];

export interface SizeTierInfo {
  tier: ParcelSizeTier;
  label: string;
  badge: string;
  example: string;
  maxWeightKg: number;
  maxVolumeCbm: number;
  typicalDimensions: { lengthCm: number; widthCm: number; heightCm: number };
  defaultMultiplier: number;
}

export const SIZE_TIERS_CONFIG: Record<ParcelSizeTier, SizeTierInfo> = {
  extra_small: {
    tier: 'extra_small',
    label: 'صغير جداً (XS)',
    badge: 'مغلف / وثائق / إكسسوارات',
    example: 'مستندات رسمية، أوراق، بطاقات، أدوية خفيفة، مجوهرات',
    maxWeightKg: 0.8,
    maxVolumeCbm: 0.005,
    typicalDimensions: { lengthCm: 25, widthCm: 18, heightCm: 4 },
    defaultMultiplier: 0.65,
  },
  small: {
    tier: 'small',
    label: 'صغير (S)',
    badge: 'علبة صغيرة / هواتف / ملابس',
    example: 'هاتف محمول، عطور، قطع غيار صغيرة، قميص، أحذية خفيفة',
    maxWeightKg: 2.5,
    maxVolumeCbm: 0.02,
    typicalDimensions: { lengthCm: 30, widthCm: 22, heightCm: 15 },
    defaultMultiplier: 0.85,
  },
  medium: {
    tier: 'medium',
    label: 'حجم متوسط (M)',
    badge: 'كرتونة قياسية / أجهزة متوسطة',
    example: 'كرتونة بضائع، طابعة مكتبية، 3-5 أزواج أحذية، خلاط منزلي',
    maxWeightKg: 7.0,
    maxVolumeCbm: 0.06,
    typicalDimensions: { lengthCm: 45, widthCm: 35, heightCm: 30 },
    defaultMultiplier: 1.0,
  },
  large: {
    tier: 'large',
    label: 'حجم كبير (L)',
    badge: 'كرتونة تجارية / حقائب ضخمة',
    example: 'شاشة تلفاز 43 بوصة، حقيبة سفر كبيرة، طرد أقمشة تجاري',
    maxWeightKg: 18.0,
    maxVolumeCbm: 0.15,
    typicalDimensions: { lengthCm: 70, widthCm: 50, heightCm: 40 },
    defaultMultiplier: 1.45,
  },
  extra_large: {
    tier: 'extra_large',
    label: 'كبير جداً (XL)',
    badge: 'شحنات ضخمة / قطع أثاث / معدات',
    example: 'غسالة، ثلاجة، أجهزة ومعدات صناعية، باليت بضائع مجزأ',
    maxWeightKg: 50.0,
    maxVolumeCbm: 0.45,
    typicalDimensions: { lengthCm: 100, widthCm: 80, heightCm: 60 },
    defaultMultiplier: 2.1,
  },
};

// Syrian Inter-Governorate Real Highway Distances in Kilometers (KM)
export const SYRIAN_DISTANCE_MATRIX: Record<Governorate, Record<Governorate, number>> = {
  دمشق: {
    دمشق: 15,
    'ريف دمشق': 20,
    حلب: 355,
    حمص: 165,
    حماة: 215,
    اللاذقية: 345,
    طرطوس: 255,
    إدلب: 330,
    درعا: 105,
    السويداء: 110,
    القنيطرة: 65,
    'دير الزور': 455,
    الرقة: 450,
    الحسكة: 610,
  },
  'ريف دمشق': {
    دمشق: 20,
    'ريف دمشق': 25,
    حلب: 365,
    حمص: 175,
    حماة: 225,
    اللاذقية: 355,
    طرطوس: 265,
    إدلب: 340,
    درعا: 115,
    السويداء: 120,
    القنيطرة: 75,
    'دير الزور': 465,
    الرقة: 460,
    الحسكة: 620,
  },
  حلب: {
    دمشق: 355,
    'ريف دمشق': 365,
    حلب: 15,
    حمص: 195,
    حماة: 145,
    اللاذقية: 185,
    طرطوس: 260,
    إدلب: 65,
    درعا: 460,
    السويداء: 465,
    القنيطرة: 420,
    'دير الزور': 350,
    الرقة: 210,
    الحسكة: 395,
  },
  حمص: {
    دمشق: 165,
    'ريف دمشق': 175,
    حلب: 195,
    حمص: 15,
    حماة: 50,
    اللاذقية: 180,
    طرطوس: 95,
    إدلب: 170,
    درعا: 270,
    السويداء: 275,
    القنيطرة: 230,
    'دير الزور': 310,
    الرقة: 290,
    الحسكة: 490,
  },
  حماة: {
    دمشق: 215,
    'ريف دمشق': 225,
    حلب: 145,
    حمص: 50,
    حماة: 15,
    اللاذقية: 145,
    طرطوس: 125,
    إدلب: 115,
    درعا: 320,
    السويداء: 325,
    القنيطرة: 280,
    'دير الزور': 360,
    الرقة: 255,
    الحسكة: 440,
  },
  اللاذقية: {
    دمشق: 345,
    'ريف دمشق': 355,
    حلب: 185,
    حمص: 180,
    حماة: 145,
    اللاذقية: 15,
    طرطوس: 85,
    إدلب: 120,
    درعا: 450,
    السويداء: 455,
    القنيطرة: 410,
    'دير الزور': 490,
    الرقة: 395,
    الحسكة: 575,
  },
  طرطوس: {
    دمشق: 255,
    'ريف دمشق': 265,
    حلب: 260,
    حمص: 95,
    حماة: 125,
    اللاذقية: 85,
    طرطوس: 15,
    إدلب: 195,
    درعا: 360,
    السويداء: 365,
    القنيطرة: 320,
    'دير الزور': 405,
    الرقة: 385,
    الحسكة: 585,
  },
  إدلب: {
    دمشق: 330,
    'ريف دمشق': 340,
    حلب: 65,
    حمص: 170,
    حماة: 115,
    اللاذقية: 120,
    طرطوس: 195,
    إدلب: 15,
    درعا: 435,
    السويداء: 440,
    القنيطرة: 395,
    'دير الزور': 415,
    الرقة: 275,
    الحسكة: 460,
  },
  درعا: {
    دمشق: 105,
    'ريف دمشق': 115,
    حلب: 460,
    حمص: 270,
    حماة: 320,
    اللاذقية: 450,
    طرطوس: 360,
    إدلب: 435,
    درعا: 15,
    السويداء: 80,
    القنيطرة: 75,
    'دير الزور': 560,
    الرقة: 555,
    الحسكة: 715,
  },
  السويداء: {
    دمشق: 110,
    'ريف دمشق': 120,
    حلب: 465,
    حمص: 275,
    حماة: 325,
    اللاذقية: 455,
    طرطوس: 365,
    إدلب: 440,
    درعا: 80,
    السويداء: 15,
    القنيطرة: 145,
    'دير الزور': 565,
    الرقة: 560,
    الحسكة: 720,
  },
  القنيطرة: {
    دمشق: 65,
    'ريف دمشق': 75,
    حلب: 420,
    حمص: 230,
    حماة: 280,
    اللاذقية: 410,
    طرطوس: 320,
    إدلب: 395,
    درعا: 75,
    السويداء: 145,
    القنيطرة: 15,
    'دير الزور': 520,
    الرقة: 515,
    الحسكة: 675,
  },
  'دير الزور': {
    دمشق: 455,
    'ريف دمشق': 465,
    حلب: 350,
    حمص: 310,
    حماة: 360,
    اللاذقية: 490,
    طرطوس: 405,
    إدلب: 415,
    درعا: 560,
    السويداء: 565,
    القنيطرة: 520,
    'دير الزور': 15,
    الرقة: 140,
    الحسكة: 180,
  },
  الرقة: {
    دمشق: 450,
    'ريف دمشق': 460,
    حلب: 210,
    حمص: 290,
    حماة: 255,
    اللاذقية: 395,
    طرطوس: 385,
    إدلب: 275,
    درعا: 555,
    السويداء: 560,
    القنيطرة: 515,
    'دير الزور': 140,
    الرقة: 15,
    الحسكة: 235,
  },
  الحسكة: {
    دمشق: 610,
    'ريف دمشق': 620,
    حلب: 395,
    حمص: 490,
    حماة: 440,
    اللاذقية: 575,
    طرطوس: 585,
    إدلب: 460,
    درعا: 715,
    السويداء: 720,
    القنيطرة: 675,
    'دير الزور': 180,
    الرقة: 235,
    الحسكة: 15,
  },
};

export const getGovernorateDistance = (origin: Governorate, destination: Governorate): number => {
  if (origin === destination) return 15; // Local intra-city delivery
  if (SYRIAN_DISTANCE_MATRIX[origin] && SYRIAN_DISTANCE_MATRIX[origin][destination]) {
    return SYRIAN_DISTANCE_MATRIX[origin][destination];
  }
  if (SYRIAN_DISTANCE_MATRIX[destination] && SYRIAN_DISTANCE_MATRIX[destination][origin]) {
    return SYRIAN_DISTANCE_MATRIX[destination][origin];
  }
  return 250; // default average
};

export interface DistanceAlgorithmSettings {
  baseFlagfallSyp: number; // e.g. 15,000 SYP (فتح البوليصة والتجهيز)
  ratePerKmSyp: number; // e.g. 45 SYP per KM
  baseFlagfallUsd: number; // e.g. $1.50
  ratePerKmUsd: number; // e.g. $0.004 per KM
  minRateSyp: number; // e.g. 15,000 SYP
  minRateUsd: number; // e.g. $1.50
}

export const DEFAULT_DISTANCE_SETTINGS: DistanceAlgorithmSettings = {
  baseFlagfallSyp: 15000,
  ratePerKmSyp: 45,
  baseFlagfallUsd: 1.5,
  ratePerKmUsd: 0.004,
  minRateSyp: 15000,
  minRateUsd: 1.5,
};

export interface CalculatedRoutePricing {
  distanceKm: number;
  baseRateSyp: number;
  extraKgRateSyp: number;
  baseRateUsd: number;
  extraKgRateUsd: number;
  cbmRateSyp: number;
  cbmRateUsd: number;
  minFeeSyp: number;
  minFeeUsd: number;
  sizePricesSyp: Record<ParcelSizeTier, number>;
  sizePricesUsd: Record<ParcelSizeTier, number>;
}

export const calculateDistanceBasedRoutePricing = (
  origin: Governorate,
  destination: Governorate,
  settings: DistanceAlgorithmSettings = DEFAULT_DISTANCE_SETTINGS
): CalculatedRoutePricing => {
  const distanceKm = getGovernorateDistance(origin, destination);

  // Damascus ↔ Aleppo (355km) -> 15,000 + (355 * 45 = 15,975) = 30,975 -> 31,000 SYP
  const rawBaseSyp = settings.baseFlagfallSyp + distanceKm * settings.ratePerKmSyp;
  const baseRateSyp = Math.max(settings.minRateSyp, Math.ceil(rawBaseSyp / 500) * 500);

  const rawBaseUsd = settings.baseFlagfallUsd + distanceKm * settings.ratePerKmUsd;
  const baseRateUsd = Math.max(settings.minRateUsd, Math.round(rawBaseUsd * 10) / 10);

  const extraKgRateSyp = Math.max(2000, Math.ceil((baseRateSyp * 0.1) / 500) * 500);
  const extraKgRateUsd = Math.max(0.2, Math.round(baseRateUsd * 0.12 * 10) / 10);

  const cbmRateSyp = Math.max(90000, Math.ceil((baseRateSyp * 4.5) / 5000) * 5000);
  const cbmRateUsd = Math.max(10.0, Math.round(baseRateUsd * 5.0));

  const minFeeSyp = Math.max(12000, Math.ceil((baseRateSyp * 0.6) / 500) * 500);
  const minFeeUsd = Math.max(1.0, Math.round(baseRateUsd * 0.6 * 10) / 10);

  // 5 Size Tiers Pricing
  const sizePricesSyp: Record<ParcelSizeTier, number> = {
    extra_small: Math.max(10000, Math.ceil((baseRateSyp * SIZE_TIERS_CONFIG.extra_small.defaultMultiplier) / 500) * 500),
    small: Math.max(12000, Math.ceil((baseRateSyp * SIZE_TIERS_CONFIG.small.defaultMultiplier) / 500) * 500),
    medium: baseRateSyp,
    large: Math.ceil((baseRateSyp * SIZE_TIERS_CONFIG.large.defaultMultiplier) / 500) * 500,
    extra_large: Math.ceil((baseRateSyp * SIZE_TIERS_CONFIG.extra_large.defaultMultiplier) / 500) * 500,
  };

  const sizePricesUsd: Record<ParcelSizeTier, number> = {
    extra_small: Math.max(1.0, Math.round(baseRateUsd * SIZE_TIERS_CONFIG.extra_small.defaultMultiplier * 10) / 10),
    small: Math.max(1.2, Math.round(baseRateUsd * SIZE_TIERS_CONFIG.small.defaultMultiplier * 10) / 10),
    medium: baseRateUsd,
    large: Math.round(baseRateUsd * SIZE_TIERS_CONFIG.large.defaultMultiplier * 10) / 10,
    extra_large: Math.round(baseRateUsd * SIZE_TIERS_CONFIG.extra_large.defaultMultiplier * 10) / 10,
  };

  return {
    distanceKm,
    baseRateSyp,
    extraKgRateSyp,
    baseRateUsd,
    extraKgRateUsd,
    cbmRateSyp,
    cbmRateUsd,
    minFeeSyp,
    minFeeUsd,
    sizePricesSyp,
    sizePricesUsd,
  };
};

/**
 * Finds the matching COD commission bracket for a given amount
 */
export const findMatchingCodBracket = (
  amount: number,
  currency: Currency = 'SYP',
  settings?: CodTransferSettings
): CodCommissionBracket | null => {
  if (!amount || amount <= 0) return null;
  const brackets = currency === 'SYP' ? settings?.bracketsSyp : settings?.bracketsUsd;
  if (!brackets || brackets.length === 0) return null;

  const sorted = [...brackets].sort((a, b) => a.fromAmount - b.fromAmount);
  // Match range: fromAmount <= amount <= toAmount (0 means infinity / open-ended)
  const match = sorted.find(
    (b) => amount >= b.fromAmount && (b.toAmount === 0 || amount <= b.toAmount)
  );
  if (match) return match;

  // If amount > highest bracket's toAmount, pick the highest bracket
  const last = sorted[sorted.length - 1];
  if (amount > last.toAmount && last.toAmount > 0) return last;

  // If amount < lowest bracket's fromAmount, pick lowest
  return sorted[0];
};

/**
 * Calculates COD remittance commission (عمولة الحوالة المالية)
 * Supports three distinct modes:
 * 1) 'custom_brackets': Tiered brackets with customizable ranges (من مبلغ إلى مبلغ والعمولة المحددة لكل شريحة).
 * 2) 'per_amount_tier': e.g., every 1,000,000 SYP has 8,000 SYP commission (proportional calculation).
 * 3) 'percentage': e.g., 2% of total COD amount.
 * Always respects minimum commission threshold protection.
 */
export const calculateCodTransferFee = (
  amount: number,
  currency: Currency = 'SYP',
  settings?: CodTransferSettings
): number => {
  if (!amount || amount <= 0) return 0;

  const mode = settings?.commissionMode || 'per_amount_tier';
  let rawFee = 0;

  if (mode === 'custom_brackets') {
    const matched = findMatchingCodBracket(amount, currency, settings);
    if (matched) {
      rawFee = matched.fee;
    } else {
      rawFee = currency === 'SYP' ? 5000 : 1;
    }
  } else if (mode === 'per_amount_tier') {
    if (currency === 'SYP') {
      const tierUnit = settings?.tierAmountSyp && settings.tierAmountSyp > 0 ? settings.tierAmountSyp : 1000000;
      const tierFee = settings?.tierFeeSyp !== undefined && settings.tierFeeSyp >= 0 ? settings.tierFeeSyp : 8000;
      // Proportional calculation: (amount / tierUnit) * tierFee
      rawFee = (amount / tierUnit) * tierFee;
    } else {
      const tierUnitUsd = settings?.tierAmountUsd && settings.tierAmountUsd > 0 ? settings.tierAmountUsd : 100;
      const tierFeeUsd = settings?.tierFeeUsd !== undefined && settings.tierFeeUsd >= 0 ? settings.tierFeeUsd : 1.5;
      rawFee = (amount / tierUnitUsd) * tierFeeUsd;
    }
  } else {
    // Percentage mode
    const percent = settings?.transferFeePercent ?? 2.0;
    rawFee = (amount * percent) / 100;
  }

  // Minimum fee protection
  if (currency === 'SYP') {
    const minFee = settings?.minTransferFeeSyp ?? 0;
    const finalFee = Math.max(rawFee, minFee);
    return Math.round(finalFee);
  } else {
    const minFeeUsd = settings?.minTransferFeeUsd ?? 0;
    const finalFeeUsd = Math.max(rawFee, minFeeUsd);
    return Math.round(finalFeeUsd * 10) / 10;
  }
};

/**
 * Returns a human-readable Arabic description of the active remittance commission policy
 */
export const getCodCommissionLabel = (
  settings?: CodTransferSettings,
  currency: Currency = 'SYP'
): string => {
  const mode = settings?.commissionMode || 'per_amount_tier';
  if (mode === 'custom_brackets') {
    const brackets = currency === 'SYP' ? settings?.bracketsSyp : settings?.bracketsUsd;
    const count = brackets?.length || 0;
    if (count === 0) return 'شرائح مخصصة (غير محددة)';
    if (count === 1) {
      const b = brackets![0];
      return `شريحة: ${formatCurrency(b.fee, currency)} (${formatCurrency(b.fromAmount, currency)} - ${formatCurrency(b.toAmount, currency)})`;
    }
    return `شرائح متدرجة (${count} شرائح)`;
  }
  if (mode === 'per_amount_tier') {
    if (currency === 'SYP') {
      const tierUnit = formatCurrency(settings?.tierAmountSyp || 1000000, 'SYP');
      const tierFee = formatCurrency(settings?.tierFeeSyp || 8000, 'SYP');
      return `${tierFee} لكل ${tierUnit}`;
    } else {
      const tierUnitUsd = formatCurrency(settings?.tierAmountUsd || 100, 'USD');
      const tierFeeUsd = formatCurrency(settings?.tierFeeUsd || 1.5, 'USD');
      return `${tierFeeUsd} لكل ${tierUnitUsd}`;
    }
  } else {
    return `${settings?.transferFeePercent ?? 2}%`;
  }
};

