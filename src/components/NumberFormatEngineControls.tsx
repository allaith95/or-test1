import React, { useState } from 'react';
import {
  Hash,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Eye,
  Sparkles,
  Coins,
  Scale,
  Box,
  Check,
  Percent,
  CheckCheck,
} from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import {
  NumberFormatSettings,
  DigitStyle,
  ThousandsSeparator,
  DecimalSeparator,
} from '../types';
import {
  DEFAULT_NUMBER_FORMAT_SETTINGS,
  formatNumber,
  formatCurrency,
  formatWeight,
  formatQuantity,
} from '../utils/numberFormatter';

export const NumberFormatEngineControls: React.FC = () => {
  const {
    brandingSettings,
    updateNumberFormatSettings,
    addAuditLog,
  } = useOrca();

  // Load current settings or fallback
  const currentSettings: NumberFormatSettings =
    brandingSettings.numberFormatSettings || DEFAULT_NUMBER_FORMAT_SETTINGS;

  // Local draft state for fine-tuning
  const [settings, setSettings] = useState<NumberFormatSettings>(currentSettings);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testInputNumber, setTestInputNumber] = useState<string>('4875250.75');

  // Handle immediate change & state update
  const handleUpdate = (partial: Partial<NumberFormatSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    updateNumberFormatSettings(next);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Preset Handlers
  const applyPreset = (type: 'recommended' | 'arabic_indic' | 'financial_clean') => {
    let preset: NumberFormatSettings;
    if (type === 'recommended') {
      preset = {
        digitStyle: 'latin',
        thousandsSeparator: 'comma',
        decimalSeparator: 'dot',
        sypDecimals: 0,
        usdDecimals: 2,
        quantityDecimals: 0,
        weightDecimals: 2,
        hideTrailingZeros: true,
        compactLargeNumbers: false,
        currencyPosition: 'suffix',
      };
    } else if (type === 'arabic_indic') {
      preset = {
        digitStyle: 'arabic_indic',
        thousandsSeparator: 'comma',
        decimalSeparator: 'arabic_comma',
        sypDecimals: 0,
        usdDecimals: 2,
        quantityDecimals: 0,
        weightDecimals: 2,
        hideTrailingZeros: true,
        compactLargeNumbers: false,
        currencyPosition: 'suffix',
      };
    } else {
      // financial_clean
      preset = {
        digitStyle: 'latin',
        thousandsSeparator: 'space',
        decimalSeparator: 'dot',
        sypDecimals: 0,
        usdDecimals: 2,
        quantityDecimals: 0,
        weightDecimals: 1,
        hideTrailingZeros: true,
        compactLargeNumbers: false,
        currencyPosition: 'suffix',
      };
    }
    setSettings(preset);
    updateNumberFormatSettings(preset);
    addAuditLog(
      'تطبيق نمط أرقام جاهز',
      'pricing',
      `تم تطبيق القالب الجاهز [${type}] لإظهار الأرقام والكسور.`
    );
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_NUMBER_FORMAT_SETTINGS);
    updateNumberFormatSettings(DEFAULT_NUMBER_FORMAT_SETTINGS);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const testNum = parseFloat(testInputNumber) || 0;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-cyan-500/10">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>نظام التحكم بإظهار الأرقام والفواصل والكسور العشرية</span>
              </h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                شامل لكافة حقول وشاشات النظام
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
              إدارة مركزية موحدة لطريقة عرض المبالغ المالية، الكميات، أوزان الشحنات، الفواصل العشرية، ونمط الأرقام عبر كافة واجهات وشاشات وتقارير النظام.
            </p>
          </div>
        </div>

        {/* Quick Presets & Reset */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('recommended')}
            className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="تطبيق النمط الموصى به"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>النمط القياسي الموصى به</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('arabic_indic')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="تطبيق الأرقام المشرقية"
          >
            <span>أرقام مشرقية (١٢٣)</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/50 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
            title="استعادة الإعدادات الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 shadow-lg shadow-emerald-950/40">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">
              تم تطبيق وحفظ إعدادات إظهار الأرقام فوراً عبر كافة واجهات وأقسام النظام!
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">تطبيق حي</span>
        </div>
      )}

      {/* Main Grid: Settings Left, Live Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Form Controls (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Digit Style (شكل ونمط الأرقام) */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <label className="text-xs font-bold text-white">
                  شكل ونمط الأرقام (الخط العددي)
                </label>
              </div>
              <span className="text-[10.5px] text-slate-400">
                {settings.digitStyle === 'latin' ? 'أرقام لاتينية (123)' : 'أرقام مشرقية (١٢٣)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleUpdate({ digitStyle: 'latin' })}
                className={`p-3 rounded-xl border text-right transition flex flex-col gap-1 cursor-pointer ${
                  settings.digitStyle === 'latin'
                    ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">أرقام إنجليزية / لاتينية</span>
                  {settings.digitStyle === 'latin' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="font-mono text-xs font-bold text-cyan-400 dir-ltr text-right">
                  123,450.00
                </div>
                <span className="text-[10px] text-slate-500">
                  النمط الأكثر استخداماً في الأنظمة المحاسبية والبريدية
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdate({ digitStyle: 'arabic_indic' })}
                className={`p-3 rounded-xl border text-right transition flex flex-col gap-1 cursor-pointer ${
                  settings.digitStyle === 'arabic_indic'
                    ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">أرقام عربية مشرقية</span>
                  {settings.digitStyle === 'arabic_indic' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="font-sans text-xs font-bold text-cyan-400">
                  ١٢٣،٤٥٠٫٠٠
                </div>
                <span className="text-[10px] text-slate-500">
                  الأرقام المشرقية التراثية المستخدمة في السجلات الرسمية
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Separators (فواصل الآلاف وفواصل الكسور) */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-bold text-white">
                الفواصل الرياضية (فصل المراتب والكسور العشرية)
              </label>
            </div>

            {/* Thousands Separator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">فاصلة الآلاف والملايين:</span>
                <span className="text-slate-400">
                  مثال: {formatNumber(1500000, { thousandsSeparator: settings.thousandsSeparator, digitStyle: settings.digitStyle })}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'comma', label: 'فاصلة (,)', sample: '1,500,000' },
                  { id: 'dot', label: 'نقطة (.)', sample: '1.500.000' },
                  { id: 'space', label: 'مسافة ( )', sample: '1 500 000' },
                  { id: 'none', label: 'بدون فاصلة', sample: '1500000' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdate({ thousandsSeparator: item.id as ThousandsSeparator })}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      settings.thousandsSeparator === item.id
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs">{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.sample}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Decimal Separator */}
            <div className="space-y-2 pt-2 border-t border-slate-850">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">فاصلة الكسور والأجزاء العشرية:</span>
                <span className="text-slate-400">
                  مثال: {formatNumber(12.75, { decimalSeparator: settings.decimalSeparator, digitStyle: settings.digitStyle, decimals: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dot', label: 'نقطة (.)', sample: '12.75' },
                  { id: 'comma', label: 'فاصلة (,)', sample: '12,75' },
                  { id: 'arabic_comma', label: 'فاصلة عربية (٫)', sample: '12٫75' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUpdate({ decimalSeparator: item.id as DecimalSeparator })}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      settings.decimalSeparator === item.id
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs">{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.sample}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Currencies & Decimals (خانات العملات والمبالغ) */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <label className="text-xs font-bold text-white">
                خانات الكسور العشرية للمبالغ المالية والعملات
              </label>
            </div>

            {/* SYP Decimals */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-850">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  الليرة السورية (SYP):
                </span>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  تحديد عدد الخانات العشرية لمبالغ الشحن والحوالات والصناديق بالليرة السورية
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {[
                  { value: 0, label: 'بدون كسور (0)', hint: 'موصى به' },
                  { value: 1, label: 'خانة (1)' },
                  { value: 2, label: 'خانتان (2)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUpdate({ sypDecimals: opt.value })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      settings.sypDecimals === opt.value
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">
                        {opt.hint}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* USD Decimals */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-850">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  الدولار الأمريكي (USD):
                </span>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  تحديد عدد الخانات العشرية لمبالغ الحوالات وأجور الشحن الدولارية
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {[
                  { value: 2, label: 'خانتان (2)', hint: 'معياري' },
                  { value: 0, label: 'بدون كسور (0)' },
                  { value: 1, label: 'خانة (1)' },
                  { value: 3, label: '3 خانات' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUpdate({ usdDecimals: opt.value })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      settings.usdDecimals === opt.value
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">
                        {opt.hint}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Symbol Position */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  موضع رمز العملة (ل.س / $):
                </span>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  مكان ظهور اسم أو رمز العملة بالنسبة للمبلغ المالي
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdate({ currencyPosition: 'suffix' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                    settings.currencyPosition === 'suffix'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  بعد الرقم (15,000 ل.س)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ currencyPosition: 'prefix' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                    settings.currencyPosition === 'prefix'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  قبل الرقم ($100)
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Quantities & Weights (الكميات والأوزان) */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              <label className="text-xs font-bold text-white">
                خانات الكسور للأوزان والكميات والقياسات
              </label>
            </div>

            {/* Weight Decimals */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-850">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  أوزان الشحنات (كغ) والحجوم (م³):
                </span>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  الدقة العشرية لوزن الطرود الفعلي والحجمي
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {[
                  { value: 2, label: 'خانتان (2.50 كغ)' },
                  { value: 1, label: 'خانة (2.5 كغ)' },
                  { value: 3, label: '3 خانات (2.500)' },
                  { value: 0, label: 'بدون كسور' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUpdate({ weightDecimals: opt.value })}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                      settings.weightDecimals === opt.value
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Decimals */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  الكميات وعدد الطرود والقطع:
                </span>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  إظهار أعداد الطرود والقطع داخل الشحنة
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {[
                  { value: 0, label: 'أعداد صحيحة (0)' },
                  { value: 1, label: 'خانة عشرية (1)' },
                  { value: 2, label: 'خانتان (2)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleUpdate({ quantityDecimals: opt.value })}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                      settings.quantityDecimals === opt.value
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5: Polish & Toggles */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  إخفاء الأصفار العشرية الزائدة إذا كان الرقم صحيحاً
                </span>
                <span className="text-[10.5px] text-slate-400">
                  مثال: إظهار <strong className="text-cyan-300">15</strong> بدلاً من{' '}
                  <strong className="text-slate-500">15.00</strong> لتنظيف الجداول والفواتير
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ hideTrailingZeros: !settings.hideTrailingZeros })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.hideTrailingZeros ? 'bg-cyan-500' : 'bg-slate-750'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                    settings.hideTrailingZeros ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2.5 border-t border-slate-850 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  اختصار الأرقام الكبيرة في الكروت والمؤشرات
                </span>
                <span className="text-[10.5px] text-slate-400">
                  عرض الملايين بصيغة مختصرة (مثلاً <strong className="text-cyan-300">1.5M</strong> بدلاً من 1,500,000) في بطاقات الإحصائيات السريعة
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ compactLargeNumbers: !settings.compactLargeNumbers })}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.compactLargeNumbers ? 'bg-cyan-500' : 'bg-slate-750'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform absolute top-0.5 ${
                    settings.compactLargeNumbers ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview Card & Playground (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-2xl p-5 shadow-2xl space-y-4 sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">لوحة المعاينة الفورية الحية</h4>
                  <span className="text-[10px] text-cyan-400">تحديث فوري لجميع نماذج الأرقام</span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {settings.digitStyle === 'latin' ? 'EN (Latin)' : 'AR (مشرقي)'}
              </span>
            </div>

            {/* Live Cards Sample */}
            <div className="space-y-2.5">
              {/* SYP Currency Sample */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold">
                    ل.س
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">مبلغ بالليرة السورية:</span>
                    <span className="text-[11px] text-slate-300 font-medium">أجور شحن أو صندوق</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-300">
                    {formatCurrency(3500000, 'SYP', settings)}
                  </span>
                </div>
              </div>

              {/* USD Currency Sample */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">
                    $
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">مبلغ بالدولار الأمريكي:</span>
                    <span className="text-[11px] text-slate-300 font-medium">حوالة COD أو رصيد</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-300">
                    {formatCurrency(2450.75, 'USD', settings)}
                  </span>
                </div>
              </div>

              {/* Parcel Weight & Quantity */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                    <Box className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">الوزن والكمية والحجم:</span>
                    <span className="text-[11px] text-slate-300 font-medium">مواصفات الطرد</span>
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-bold text-purple-300">
                    {formatWeight(14.85, settings)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {formatQuantity(5, 'طرود', settings)} • {formatNumber(0.045, { decimals: settings.weightDecimals, unit: 'م³' }, settings)}
                  </div>
                </div>
              </div>

              {/* Commission Percentage Preview */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">نسبة عمولة الحوالات COD:</span>
                    <span className="text-[11px] text-slate-300 font-medium">النسبة المطبقة تلقائياً</span>
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-bold text-cyan-300">
                    {formatNumber(2.5, { decimals: 1, suffix: '%' }, settings)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    نسبة مئوية
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Playground Sandbox */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>حقل تجربة رقم حي (اختبر أي قيمة):</span>
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={testInputNumber}
                  onChange={(e) => setTestInputNumber(e.target.value)}
                  placeholder="أدخل رقماً للاختبار..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">كناتج بالليرة السورية:</span>
                  <span className="font-bold text-amber-400">
                    {formatCurrency(testNum, 'SYP', settings)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">كناتج بالدولار الأمريكي:</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(testNum, 'USD', settings)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">كوزن شحنة:</span>
                  <span className="font-bold text-purple-400">
                    {formatWeight(testNum, settings)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px] text-slate-400">كرقم مجرد مع الفواصل:</span>
                  <span className="font-bold text-cyan-300">
                    {formatNumber(testNum, {}, settings)}
                  </span>
                </div>
              </div>
            </div>

            {/* Guarantee Note */}
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200/90 leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                تُحفظ كافة خياراتك تلقائياً في قاعدة البيانات والمتصفح، وتنعكس مباشرة على كشوفات الشحن، فواتير الطرود، الصناديق، وتقارير الإدارة المركزية.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
