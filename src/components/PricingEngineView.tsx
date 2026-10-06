import React, { useState, useEffect, useRef } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  DollarSign,
  Save,
  ArrowLeftRight,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Calculator,
  ArrowRight,
  Wallet,
  Receipt,
  Package,
  Building2,
  Info,
  Plus,
  X,
  SlidersHorizontal,
  Check,
  Coins,
  Percent,
  Sparkles,
  HelpCircle,
  CreditCard,
  Banknote,
  Tag,
  Edit2,
  Trash2,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { DEFAULT_PACKAGE_TYPES, DEFAULT_ID_DOCUMENT_TYPES, DEFAULT_COD_BRACKETS_SYP, DEFAULT_COD_BRACKETS_USD } from '../data/initialData';
import { PricingPolicyMode, CodCommissionMode, CodTransferSettings, Currency, CodCommissionBracket } from '../types';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import { calculateCodTransferFee, getCodCommissionLabel, findMatchingCodBracket } from '../utils/distanceEngine';
import { NumberFormatEngineControls } from './NumberFormatEngineControls';

export const PricingEngineView: React.FC = () => {
  const {
    brandingSettings,
    updateBrandingSettings,
    codSettings,
    updateCodSettings,
    addAuditLog,
    currentUser,
    setActiveModule,
    formatCurrency,
    formatNumber,
    formatExchangeRate,
  } = useOrca();

  // Dirty tracker to prevent background sync from wiping unsaved edits
  const isCodDirtyRef = useRef(false);
  const isRateDirtyRef = useRef(false);

  // Remittance Commission (COD Transfer) Settings State
  const [commissionMode, setCommissionMode] = useState<CodCommissionMode>(
    codSettings?.commissionMode || 'per_amount_tier'
  );
  const [transferFeePercent, setTransferFeePercent] = useState<number>(
    codSettings?.transferFeePercent ?? 0
  );
  const [transferFeePercentStr, setTransferFeePercentStr] = useState<string>(
    codSettings?.transferFeePercent ? String(codSettings.transferFeePercent) : ''
  );

  const [tierAmountSyp, setTierAmountSyp] = useState<number>(
    codSettings?.tierAmountSyp ?? 0
  );
  const [tierAmountSypStr, setTierAmountSypStr] = useState<string>(
    codSettings?.tierAmountSyp ? String(codSettings.tierAmountSyp) : ''
  );

  const [tierFeeSyp, setTierFeeSyp] = useState<number>(
    codSettings?.tierFeeSyp ?? 0
  );
  const [tierFeeSypStr, setTierFeeSypStr] = useState<string>(
    codSettings?.tierFeeSyp ? String(codSettings.tierFeeSyp) : ''
  );

  const [tierAmountUsd, setTierAmountUsd] = useState<number>(
    codSettings?.tierAmountUsd ?? 0
  );
  const [tierAmountUsdStr, setTierAmountUsdStr] = useState<string>(
    codSettings?.tierAmountUsd ? String(codSettings.tierAmountUsd) : ''
  );

  const [tierFeeUsd, setTierFeeUsd] = useState<number>(
    codSettings?.tierFeeUsd ?? 0
  );
  const [tierFeeUsdStr, setTierFeeUsdStr] = useState<string>(
    codSettings?.tierFeeUsd ? String(codSettings.tierFeeUsd) : ''
  );

  const [bracketsSyp, setBracketsSyp] = useState<CodCommissionBracket[]>(
    () => codSettings?.bracketsSyp || DEFAULT_COD_BRACKETS_SYP
  );
  const [bracketsUsd, setBracketsUsd] = useState<CodCommissionBracket[]>(
    () => codSettings?.bracketsUsd || DEFAULT_COD_BRACKETS_USD
  );
  const [activeBracketCurrency, setActiveBracketCurrency] = useState<Currency>('SYP');

  // Next 'From' helper
  const getNextFromAmount = (brackets: CodCommissionBracket[]): number => {
    if (!brackets || brackets.length === 0) return 0;
    const sorted = [...brackets].sort((a, b) => b.toAmount - a.toAmount);
    return sorted[0].toAmount > 0 ? sorted[0].toAmount + 1 : 0;
  };

  const [newBracketFrom, setNewBracketFrom] = useState<string>(() =>
    String(getNextFromAmount(codSettings?.bracketsSyp || DEFAULT_COD_BRACKETS_SYP))
  );
  const [newBracketTo, setNewBracketTo] = useState<string>('');
  const [newBracketFee, setNewBracketFee] = useState<string>('');
  const [bracketValidationError, setBracketValidationError] = useState<string>('');
  const [bracketSuccessMsg, setBracketSuccessMsg] = useState<string>('');

  const [minTransferFeeSyp, setMinTransferFeeSyp] = useState<number>(
    codSettings?.minTransferFeeSyp ?? 0
  );
  const [minTransferFeeSypStr, setMinTransferFeeSypStr] = useState<string>(
    codSettings?.minTransferFeeSyp ? String(codSettings.minTransferFeeSyp) : ''
  );

  const [minTransferFeeUsd, setMinTransferFeeUsd] = useState<number>(
    codSettings?.minTransferFeeUsd ?? 0
  );
  const [minTransferFeeUsdStr, setMinTransferFeeUsdStr] = useState<string>(
    codSettings?.minTransferFeeUsd ? String(codSettings.minTransferFeeUsd) : ''
  );

  const [maxCodAllowedSyp, setMaxCodAllowedSyp] = useState<number>(
    codSettings?.maxCodAllowedSyp ?? 0
  );
  const [maxCodAllowedSypStr, setMaxCodAllowedSypStr] = useState<string>(
    codSettings?.maxCodAllowedSyp ? String(codSettings.maxCodAllowedSyp) : ''
  );

  const [maxCodAllowedUsd, setMaxCodAllowedUsd] = useState<number>(
    codSettings?.maxCodAllowedUsd ?? 0
  );
  const [maxCodAllowedUsdStr, setMaxCodAllowedUsdStr] = useState<string>(
    codSettings?.maxCodAllowedUsd ? String(codSettings.maxCodAllowedUsd) : ''
  );

  const [codSaveSuccess, setCodSaveSuccess] = useState<boolean>(false);

  // Multi-Currency Delivery Policy State (سياسة تعدد العملات في تسليم الطرود)
  const [allowMultiCurrencyDelivery, setAllowMultiCurrencyDelivery] = useState<boolean>(
    brandingSettings.allowMultiCurrencyDelivery ?? false
  );
  const [currencyPolicySavedSuccess, setCurrencyPolicySavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    setAllowMultiCurrencyDelivery(brandingSettings.allowMultiCurrencyDelivery ?? false);
  }, [brandingSettings.allowMultiCurrencyDelivery]);

  const handleToggleMultiCurrencyDelivery = (allowed: boolean) => {
    setAllowMultiCurrencyDelivery(allowed);
    updateBrandingSettings({
      allowMultiCurrencyDelivery: allowed,
    });
    addAuditLog(
      'تحديث سياسة تعدد العملات في التسليم',
      'pricing',
      allowed
        ? 'تم تفعيل السماح بتعدد العملات وإتاحة خيارات التحويل (كلا العملتين / ليرة / دولار) في واجهة تسليم الطرود.'
        : 'تم قفل خيارات التحويل وإلزام القبض المنفصل: كل عملة تحافظ على عملتها الأصلية ويجب قبض كل عملة على حدة بصندوقها.'
    );
    setCurrencyPolicySavedSuccess(true);
    setTimeout(() => setCurrencyPolicySavedSuccess(false), 3500);
  };

  // Sync state if codSettings updates externally AND user is not actively editing
  useEffect(() => {
    if (codSettings && !isCodDirtyRef.current) {
      setCommissionMode(codSettings.commissionMode || 'per_amount_tier');
      setTransferFeePercent(codSettings.transferFeePercent ?? 0);
      setTransferFeePercentStr(codSettings.transferFeePercent ? String(codSettings.transferFeePercent) : '');
      setTierAmountSyp(codSettings.tierAmountSyp ?? 0);
      setTierAmountSypStr(codSettings.tierAmountSyp ? String(codSettings.tierAmountSyp) : '');
      setTierFeeSyp(codSettings.tierFeeSyp ?? 0);
      setTierFeeSypStr(codSettings.tierFeeSyp ? String(codSettings.tierFeeSyp) : '');
      setTierAmountUsd(codSettings.tierAmountUsd ?? 0);
      setTierAmountUsdStr(codSettings.tierAmountUsd ? String(codSettings.tierAmountUsd) : '');
      setTierFeeUsd(codSettings.tierFeeUsd ?? 0);
      setTierFeeUsdStr(codSettings.tierFeeUsd ? String(codSettings.tierFeeUsd) : '');
      setBracketsSyp(codSettings.bracketsSyp || DEFAULT_COD_BRACKETS_SYP);
      setBracketsUsd(codSettings.bracketsUsd || DEFAULT_COD_BRACKETS_USD);
      setMinTransferFeeSyp(codSettings.minTransferFeeSyp ?? 0);
      setMinTransferFeeSypStr(codSettings.minTransferFeeSyp ? String(codSettings.minTransferFeeSyp) : '');
      setMinTransferFeeUsd(codSettings.minTransferFeeUsd ?? 0);
      setMinTransferFeeUsdStr(codSettings.minTransferFeeUsd ? String(codSettings.minTransferFeeUsd) : '');
      setMaxCodAllowedSyp(codSettings.maxCodAllowedSyp ?? 0);
      setMaxCodAllowedSypStr(codSettings.maxCodAllowedSyp ? String(codSettings.maxCodAllowedSyp) : '');
      setMaxCodAllowedUsd(codSettings.maxCodAllowedUsd ?? 0);
      setMaxCodAllowedUsdStr(codSettings.maxCodAllowedUsd ? String(codSettings.maxCodAllowedUsd) : '');
    }
  }, [codSettings]);

  const handleSelectCommissionMode = (mode: CodCommissionMode) => {
    isCodDirtyRef.current = true;
    setCommissionMode(mode);
  };

  // Switch bracket currency
  const handleSwitchBracketCurrency = (cur: Currency) => {
    setActiveBracketCurrency(cur);
    const target = cur === 'SYP' ? bracketsSyp : bracketsUsd;
    setNewBracketFrom(String(getNextFromAmount(target)));
    setNewBracketTo('');
    setNewBracketFee('');
    setBracketValidationError('');
  };

  // Add a new bracket and open inputs for the next bracket
  const handleAddBracket = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBracketValidationError('');

    const fromVal = parseFloat(newBracketFrom);
    const toVal = parseFloat(newBracketTo);
    const feeVal = parseFloat(newBracketFee);

    if (isNaN(fromVal) || fromVal < 0) {
      setBracketValidationError('يرجى إدخال مبلغ البداية (من) بشكل صحيح');
      return;
    }
    if (isNaN(toVal) || toVal <= fromVal) {
      setBracketValidationError('يرجى إدخال مبلغ النهاية (إلى) بحيث يكون أكبر من مبلغ البداية (من)');
      return;
    }
    if (isNaN(feeVal) || feeVal < 0) {
      setBracketValidationError('يرجى إدخال قيمة العمولة للشريحة');
      return;
    }

    isCodDirtyRef.current = true;
    const newBracket: CodCommissionBracket = {
      id: `b_${activeBracketCurrency.toLowerCase()}_${Date.now()}`,
      fromAmount: fromVal,
      toAmount: toVal,
      fee: feeVal,
    };

    if (activeBracketCurrency === 'SYP') {
      const updated = [...bracketsSyp, newBracket].sort((a, b) => a.fromAmount - b.fromAmount);
      setBracketsSyp(updated);
      setNewBracketFrom(String(toVal + 1));
    } else {
      const updated = [...bracketsUsd, newBracket].sort((a, b) => a.fromAmount - b.fromAmount);
      setBracketsUsd(updated);
      setNewBracketFrom(String(toVal + 1));
    }

    setNewBracketTo('');
    setNewBracketFee('');
    setBracketSuccessMsg('تم حفظ الشريحة وفتح حقول الشريحة التالية تلقائياً');
    setTimeout(() => setBracketSuccessMsg(''), 3000);
  };

  // Delete bracket
  const handleDeleteBracket = (id: string, cur: Currency) => {
    isCodDirtyRef.current = true;
    if (cur === 'SYP') {
      const updated = bracketsSyp.filter((b) => b.id !== id);
      setBracketsSyp(updated);
      setNewBracketFrom(String(getNextFromAmount(updated)));
    } else {
      const updated = bracketsUsd.filter((b) => b.id !== id);
      setBracketsUsd(updated);
      setNewBracketFrom(String(getNextFromAmount(updated)));
    }
  };

  // Reset default brackets
  const handleResetDefaultBrackets = (cur: Currency) => {
    isCodDirtyRef.current = true;
    if (cur === 'SYP') {
      setBracketsSyp(DEFAULT_COD_BRACKETS_SYP);
      setNewBracketFrom(String(getNextFromAmount(DEFAULT_COD_BRACKETS_SYP)));
    } else {
      setBracketsUsd(DEFAULT_COD_BRACKETS_USD);
      setNewBracketFrom(String(getNextFromAmount(DEFAULT_COD_BRACKETS_USD)));
    }
    setNewBracketTo('');
    setNewBracketFee('');
    setBracketSuccessMsg('تمت استعادة الشرائح الافتراضية');
    setTimeout(() => setBracketSuccessMsg(''), 3000);
  };

  // Clear all brackets
  const handleClearAllBrackets = (cur: Currency) => {
    isCodDirtyRef.current = true;
    if (cur === 'SYP') {
      setBracketsSyp([]);
    } else {
      setBracketsUsd([]);
    }
    setNewBracketFrom('0');
    setNewBracketTo('');
    setNewBracketFee('');
  };

  // Live Commission Simulation Tester State
  const [simCurrency, setSimCurrency] = useState<Currency>('SYP');
  const [simAmountInput, setSimAmountInput] = useState<string>('');
  const [simAmount, setSimAmount] = useState<number>(0);

  const handleSimAmountChange = (valStr: string) => {
    const clean = sanitizeDecimal(valStr);
    setSimAmountInput(clean);
    const num = parseFloat(clean) || 0;
    setSimAmount(num);
  };

  const handleSetQuickSimAmount = (amount: number, cur: Currency) => {
    setSimCurrency(cur);
    setSimAmount(amount);
    setSimAmountInput(String(amount));
  };

  // Build live simulated settings object for real-time reactivity
  const liveSimulatedCodSettings: CodTransferSettings = {
    ...codSettings,
    commissionMode,
    transferFeePercent,
    tierAmountSyp,
    tierFeeSyp,
    tierAmountUsd,
    tierFeeUsd,
    bracketsSyp,
    bracketsUsd,
    minTransferFeeSyp,
    minTransferFeeUsd,
    maxCodAllowedSyp,
    maxCodAllowedUsd,
    payoutGraceHours: codSettings?.payoutGraceHours || 24,
    autoSmsOnCollection: codSettings?.autoSmsOnCollection ?? true,
  };

  const liveCalculatedFee = calculateCodTransferFee(simAmount, simCurrency, liveSimulatedCodSettings);
  const liveMatchedBracket = commissionMode === 'custom_brackets'
    ? findMatchingCodBracket(simAmount, simCurrency, liveSimulatedCodSettings)
    : null;

  // Save Remittance Commission Settings
  const handleSaveCodSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: CodTransferSettings = {
      ...codSettings,
      commissionMode,
      transferFeePercent,
      tierAmountSyp,
      tierFeeSyp,
      tierAmountUsd,
      tierFeeUsd,
      bracketsSyp,
      bracketsUsd,
      minTransferFeeSyp,
      minTransferFeeUsd,
      maxCodAllowedSyp,
      maxCodAllowedUsd,
    };
    updateCodSettings(updated);
    isCodDirtyRef.current = false;
    const modeDesc = commissionMode === 'custom_brackets'
      ? 'عمولة حسب شرائح المبالغ'
      : commissionMode === 'per_amount_tier'
      ? 'لكل شريحة مبلغ'
      : 'نسبة مئوية';
    addAuditLog(
      'تحديث تعرفة عمولة الحوالات',
      'pricing',
      `تم تثبيت تعرفة الحوالات المالية: النمط [${modeDesc}] - ${getCodCommissionLabel(updated, 'SYP')}`
    );
    setCodSaveSuccess(true);
    setTimeout(() => setCodSaveSuccess(false), 4000);
  };

  // Exchange Rate State (USD -> SYP) - Unrestricted free-form typing
  const currentMasterRate = brandingSettings.exchangeRateUsdToSyp ?? 0;
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(
    currentMasterRate > 0 ? String(currentMasterRate) : ''
  );
  const [exchangeRate, setExchangeRate] = useState<number>(currentMasterRate);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [lastSavedRate, setLastSavedRate] = useState<number>(currentMasterRate);

  // Sync state if brandingSettings changes externally
  useEffect(() => {
    if (!isRateDirtyRef.current) {
      const rate = brandingSettings.exchangeRateUsdToSyp ?? 0;
      setExchangeRate(rate);
      setExchangeRateInput(rate > 0 ? String(rate) : '');
      setLastSavedRate(rate);
    }
  }, [brandingSettings.exchangeRateUsdToSyp]);

  // Quick Live Converter State
  const [convertUsd, setConvertUsd] = useState<string>(currentMasterRate > 0 ? '100' : '');
  const [convertSyp, setConvertSyp] = useState<string>(
    currentMasterRate > 0 ? formatNumber(100 * currentMasterRate) : ''
  );

  // Package Types Management State (When Manual Pricing is Selected)
  const [showAddTypeInput, setShowAddTypeInput] = useState<boolean>(false);
  const [newPackageTypeName, setNewPackageTypeName] = useState<string>('');
  const [newTypePriceSyp, setNewTypePriceSyp] = useState<string>('');
  const [newTypePriceUsd, setNewTypePriceUsd] = useState<string>('');
  const [newTypeMinPriceSyp, setNewTypeMinPriceSyp] = useState<string>('');
  const [newTypeMinPriceUsd, setNewTypeMinPriceUsd] = useState<string>('');
  const [editingRateType, setEditingRateType] = useState<string | null>(null);
  const [editRateSyp, setEditRateSyp] = useState<string>('');
  const [editRateUsd, setEditRateUsd] = useState<string>('');
  const [editMinRateSyp, setEditMinRateSyp] = useState<string>('');
  const [editMinRateUsd, setEditMinRateUsd] = useState<string>('');
  const [typeActionMessage, setTypeActionMessage] = useState<string | null>(null);

  // ID Document Types Management State
  const [showAddIdDocTypeInput, setShowAddIdDocTypeInput] = useState<boolean>(false);
  const [newIdDocTypeInput, setNewIdDocTypeInput] = useState<string>('');
  const [editingIdDocTypeIdx, setEditingIdDocTypeIdx] = useState<number | null>(null);
  const [editingIdDocTypeName, setEditingIdDocTypeName] = useState<string>('');
  const [idDocTypeActionMsg, setIdDocTypeActionMsg] = useState<string | null>(null);

  const packageTypes: string[] =
    brandingSettings.packageTypes && brandingSettings.packageTypes.length > 0
      ? brandingSettings.packageTypes
      : DEFAULT_PACKAGE_TYPES;

  const idDocumentTypes: string[] =
    brandingSettings.idDocumentTypes && brandingSettings.idDocumentTypes.length > 0
      ? brandingSettings.idDocumentTypes
      : DEFAULT_ID_DOCUMENT_TYPES;

  const handleAddIdDocType = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newIdDocTypeInput.trim();
    if (!trimmed) return;

    if (idDocumentTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setIdDocTypeActionMsg(`نوع الوثيقة "${trimmed}" موجود مسبقاً في القائمة.`);
      setTimeout(() => setIdDocTypeActionMsg(null), 3000);
      return;
    }

    const updated = [...idDocumentTypes, trimmed];
    updateBrandingSettings({ idDocumentTypes: updated });
    addAuditLog('إضافة نوع وثيقة جديد', 'pricing', `تمت إضافة نوع وثيقة الهوية: [${trimmed}]`);

    setNewIdDocTypeInput('');
    setShowAddIdDocTypeInput(false);
    setIdDocTypeActionMsg(`✓ تمت إضافة نوع الوثيقة [${trimmed}] بنجاح`);
    setTimeout(() => setIdDocTypeActionMsg(null), 3500);
  };

  const handleSaveEditIdDocType = (index: number) => {
    const trimmed = editingIdDocTypeName.trim();
    if (!trimmed) return;

    const updated = [...idDocumentTypes];
    const oldName = updated[index];
    updated[index] = trimmed;

    updateBrandingSettings({ idDocumentTypes: updated });
    addAuditLog('تعديل اسم نوع الوثيقة', 'pricing', `تم تعديل نوع الوثيقة من [${oldName}] إلى [${trimmed}]`);

    setEditingIdDocTypeIdx(null);
    setEditingIdDocTypeName('');
    setIdDocTypeActionMsg(`✓ تم تعديل نوع الوثيقة إلى [${trimmed}] بنجاح`);
    setTimeout(() => setIdDocTypeActionMsg(null), 3500);
  };

  const handleRemoveIdDocType = (typeName: string) => {
    if (idDocumentTypes.length <= 1) {
      setIdDocTypeActionMsg('تنبيه: يجب أن تحتوي القائمة على نوع وثيقة واحد على الأقل.');
      setTimeout(() => setIdDocTypeActionMsg(null), 3500);
      return;
    }

    const updated = idDocumentTypes.filter((t) => t !== typeName);
    updateBrandingSettings({ idDocumentTypes: updated });
    addAuditLog('حذف نوع وثيقة', 'pricing', `تم حذف نوع وثيقة الهوية [${typeName}]`);

    setIdDocTypeActionMsg(`✓ تم حذف نوع الوثيقة [${typeName}] بنجاح`);
    setTimeout(() => setIdDocTypeActionMsg(null), 3500);
  };

  const handleResetDefaultIdDocTypes = () => {
    updateBrandingSettings({ idDocumentTypes: DEFAULT_ID_DOCUMENT_TYPES });
    addAuditLog('استعادة أنواع الوثائق الافتراضية', 'pricing', 'تمت استعادة قائمة أنواع الوثائق الافتراضية في النظام');
    setIdDocTypeActionMsg('✓ تمت استعادة قائمة أنواع الوثائق الافتراضية');
    setTimeout(() => setIdDocTypeActionMsg(null), 3500);
  };

  useEffect(() => {
    const rate = brandingSettings.exchangeRateUsdToSyp ?? 0;
    setExchangeRate(rate);
    setLastSavedRate(rate);
  }, [brandingSettings.exchangeRateUsdToSyp]);

  // Enforce manual pricing policy as the sole approved policy
  useEffect(() => {
    if (brandingSettings.activePricingPolicy !== 'manual_pricing') {
      updateBrandingSettings({ activePricingPolicy: 'manual_pricing' });
    }
  }, [brandingSettings.activePricingPolicy, updateBrandingSettings]);

  // Handle Add New Package Type (مع إمكانية ربط أجور شحن ثابتة وحد أدنى للتعديل اختيارياً)
  const handleAddNewPackageType = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPackageTypeName.trim();
    if (!trimmed) return;

    if (packageTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTypeActionMessage(`نوع الطرد "${trimmed}" موجود مسبقاً في القائمة.`);
      setTimeout(() => setTypeActionMessage(null), 3000);
      return;
    }

    const updated = [...packageTypes, trimmed];
    const numSyp = parseFloat(newTypePriceSyp) || 0;
    const numUsd = parseFloat(newTypePriceUsd) || 0;
    const minSyp = parseFloat(newTypeMinPriceSyp) || 0;
    const minUsd = parseFloat(newTypeMinPriceUsd) || 0;

    let updatedRates = { ...(brandingSettings.packageTypeRates || {}) };
    if (numSyp > 0 || numUsd > 0 || minSyp > 0 || minUsd > 0) {
      updatedRates[trimmed] = {
        fixedPriceSyp: numSyp > 0 ? numSyp : undefined,
        fixedPriceUsd: numUsd > 0 ? numUsd : undefined,
        minPriceSyp: minSyp > 0 ? minSyp : undefined,
        minPriceUsd: minUsd > 0 ? minUsd : undefined,
        autoApply: true,
      };
    }

    updateBrandingSettings({
      packageTypes: updated,
      packageTypeRates: updatedRates,
    });

    const sypDetails = numSyp > 0 ? `${formatNumber(numSyp)} ل.س` : '';
    const minSypDetails = minSyp > 0 ? `(حد أدنى: ${formatNumber(minSyp)} ل.س)` : '';
    const usdDetails = numUsd > 0 ? `$${numUsd}` : '';
    const minUsdDetails = minUsd > 0 ? `(حد أدنى: $${minUsd})` : '';

    addAuditLog(
      'إضافة نوع طرد جديد',
      'pricing',
      `تمت إضافة نوع الطرد: [${trimmed}] ${
        numSyp > 0 || numUsd > 0 || minSyp > 0 || minUsd > 0
          ? `مع ربط أجور (${[sypDetails, minSypDetails, usdDetails, minUsdDetails].filter(Boolean).join(' ')})`
          : 'بدون أجور ثابتة (إدخال حر)'
      }`
    );

    setNewPackageTypeName('');
    setNewTypePriceSyp('');
    setNewTypePriceUsd('');
    setNewTypeMinPriceSyp('');
    setNewTypeMinPriceUsd('');
    setShowAddTypeInput(false);
    setTypeActionMessage(`✓ تمت إضافة [${trimmed}] بنجاح إلى قائمة إدخال البيانات`);
    setTimeout(() => setTypeActionMessage(null), 3500);
  };

  // Open Rate Editor for an existing package type
  const handleOpenRateEditor = (typeName: string) => {
    setEditingRateType(typeName);
    const existingRate = brandingSettings.packageTypeRates?.[typeName];
    setEditRateSyp(existingRate?.fixedPriceSyp ? String(existingRate.fixedPriceSyp) : '');
    setEditRateUsd(existingRate?.fixedPriceUsd ? String(existingRate.fixedPriceUsd) : '');
    setEditMinRateSyp(existingRate?.minPriceSyp ? String(existingRate.minPriceSyp) : '');
    setEditMinRateUsd(existingRate?.minPriceUsd ? String(existingRate.minPriceUsd) : '');
  };

  // Save Rate Editor changes
  const handleSaveRateEditor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingRateType) return;

    const numSyp = parseFloat(editRateSyp) || 0;
    const numUsd = parseFloat(editRateUsd) || 0;
    const minSyp = parseFloat(editMinRateSyp) || 0;
    const minUsd = parseFloat(editMinRateUsd) || 0;
    const currentRates = { ...(brandingSettings.packageTypeRates || {}) };

    if (numSyp > 0 || numUsd > 0 || minSyp > 0 || minUsd > 0) {
      currentRates[editingRateType] = {
        fixedPriceSyp: numSyp > 0 ? numSyp : undefined,
        fixedPriceUsd: numUsd > 0 ? numUsd : undefined,
        minPriceSyp: minSyp > 0 ? minSyp : undefined,
        minPriceUsd: minUsd > 0 ? minUsd : undefined,
        autoApply: true,
      };

      const sypText = numSyp > 0 ? `${formatNumber(numSyp)} ل.س` : '';
      const minSypText = minSyp > 0 ? `(حد أدنى للتعديل: ${formatNumber(minSyp)} ل.س)` : '';
      const usdText = numUsd > 0 ? `$${numUsd}` : '';
      const minUsdText = minUsd > 0 ? `(حد أدنى للتعديل: $${minUsd})` : '';

      addAuditLog(
        'تحديد أجور ثابتة لنوع طرد',
        'pricing',
        `تم ربط أجور شحن وضوابط لنوع الطرد [${editingRateType}]: ${[sypText, minSypText, usdText, minUsdText].filter(Boolean).join(' ')}`
      );
      setTypeActionMessage(`✓ تم حفظ وتثبيت أجور شحن وضوابط [${editingRateType}] بنجاح`);
    } else {
      delete currentRates[editingRateType];
      addAuditLog('إلغاء أجور نوع طرد', 'pricing', `تم إلغاء الأجور الثابتة لنوع الطرد [${editingRateType}]`);
      setTypeActionMessage(`تم تصفير الأجور الثابتة لـ [${editingRateType}] ليصبح إدخال حر`);
    }

    updateBrandingSettings({ packageTypeRates: currentRates });
    setEditingRateType(null);
    setTimeout(() => setTypeActionMessage(null), 3500);
  };

  // Quick Clear Rate
  const handleClearRate = (typeName: string) => {
    const currentRates = { ...(brandingSettings.packageTypeRates || {}) };
    delete currentRates[typeName];
    updateBrandingSettings({ packageTypeRates: currentRates });
    addAuditLog('إلغاء أجور نوع طرد', 'pricing', `تم إلغاء الأجور الثابتة لنوع الطرد [${typeName}]`);
    setTypeActionMessage(`تم إلغاء الأجور الثابتة لنوع [${typeName}]`);
    setTimeout(() => setTypeActionMessage(null), 3000);
  };

  // Handle Remove Package Type
  const handleRemovePackageType = (typeToRemove: string) => {
    if (packageTypes.length <= 1) {
      setTypeActionMessage('تنبيه: يجب الإبقاء على نوع طرد واحد على الأقل في القائمة.');
      setTimeout(() => setTypeActionMessage(null), 3500);
      return;
    }
    const updated = packageTypes.filter((t) => t !== typeToRemove);
    const updatedRates = { ...(brandingSettings.packageTypeRates || {}) };
    delete updatedRates[typeToRemove];

    updateBrandingSettings({
      packageTypes: updated,
      packageTypeRates: updatedRates,
    });
    addAuditLog('حذف نوع طرد', 'pricing', `تم حذف نوع الطرد: [${typeToRemove}]`);
    setTypeActionMessage(`✓ تم حذف [${typeToRemove}] من قائمة إدخال البيانات`);
    setTimeout(() => setTypeActionMessage(null), 3000);
  };

  // Handle Reset Default Types
  const handleResetDefaultTypes = () => {
    updateBrandingSettings({ packageTypes: DEFAULT_PACKAGE_TYPES });
    addAuditLog('استعادة أنواع الطرود الافتراضية', 'pricing', 'تمت استعادة قائمة أنواع الطرود القياسية في النظام');
    setTypeActionMessage('✓ تمت استعادة قائمة أنواع الطرود الافتراضية');
    setTimeout(() => setTypeActionMessage(null), 3000);
  };

  // Free-form rate change handler with immediate global propagation
  const handleRateInputChange = (valStr: string) => {
    isRateDirtyRef.current = true;
    const cleanStr = sanitizeDecimal(valStr);
    setExchangeRateInput(cleanStr);
    const num = parseFloat(cleanStr);
    if (!isNaN(num) && num > 0) {
      setExchangeRate(num);
      updateBrandingSettings({
        exchangeRateUsdToSyp: num,
      });
      const numUsd = parseFloat(convertUsd) || 0;
      setConvertSyp(formatNumber(numUsd * num));
    }
  };

  // Handle Save Master Exchange Rate
  const handleSaveRate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isRateDirtyRef.current = false;
    const cleanStr = exchangeRateInput.replace(/[^\d.]/g, '');
    const num = parseFloat(cleanStr) || exchangeRate;
    if (num <= 0) return;

    setExchangeRate(num);
    setExchangeRateInput(String(num));
    updateBrandingSettings({
      exchangeRateUsdToSyp: num,
    });

    addAuditLog(
      'تثبيت سعر الصرف الرئيسي',
      'pricing',
      `تم تثبيت سعر صرف الدولار المرجعي في البرنامج كاملاً إلى: ${formatExchangeRate(num)} ل.س`
    );

    setLastSavedRate(num);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);

    // Update converter preview
    const numUsd = parseFloat(convertUsd) || 0;
    setConvertSyp(formatNumber(numUsd * num));
  };

  // Two-way converter handlers
  const handleUsdChange = (valStr: string) => {
    const clean = sanitizeDecimal(valStr);
    setConvertUsd(clean);
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      setConvertSyp(formatNumber(num * exchangeRate));
    } else {
      setConvertSyp('');
    }
  };

  const handleSypChange = (valStr: string) => {
    const cleanStr = sanitizeDecimal(valStr.replace(/,/g, ''));
    setConvertSyp(cleanStr);
    const num = parseFloat(cleanStr);
    if (!isNaN(num) && exchangeRate > 0) {
      setConvertUsd((num / exchangeRate).toFixed(2));
    } else {
      setConvertUsd('');
    }
  };

  // Preset quick adjustments
  const adjustRate = (delta: number) => {
    const newRate = Math.max(1, exchangeRate + delta);
    setExchangeRate(newRate);
    setExchangeRateInput(String(newRate));
    updateBrandingSettings({
      exchangeRateUsdToSyp: newRate,
    });
    const numUsd = parseFloat(convertUsd) || 0;
    setConvertSyp(formatNumber(numUsd * newRate));
  };

  return (
    <div className="space-y-5 pb-20 text-slate-100 w-full max-w-full px-1 sm:px-3">
      {/* Top Header Card */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white">
                محرك التسعير والتعرفة وإدارة العملات
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                تسعير يدوي معتمد
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديد سياسة التسعير المعتمدة، إدارة أنواع وبنود الطرود، وتعرفة عمولات الحوالات
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveModule('dashboard')}
          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للوحة القيادة</span>
        </button>
      </div>

      {/* Pricing Policy Card (السياسة اليدوية المعتمدة والوحيدة) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
              <span>سياسة التسعير المعتمدة للنظام والفروع</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تم اعتماد سياسة التسعير اليدوي كمرجع وحيد، وحذف سياسة التسعير الآلي نهائياً لضمان مرونة التسعير حسب الاتفاق
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold border shrink-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>السياسة الوحيدة المعتمدة: تسعير يدوي مخصص</span>
          </span>
        </div>

        {/* Manual Pricing Details Card */}
        <div className="p-4 rounded-xl border bg-emerald-950/30 border-emerald-500/40 shadow-lg shadow-emerald-950/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                ✍️
              </div>
              <div>
                <span className="font-bold text-white text-sm">سياسة التسعير اليدوي للشحنات والطرود (المعتمدة رسمياً)</span>
                <span className="mr-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  كافة الفروع
                </span>
              </div>
            </div>
            <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> نشطة ومطبقة
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            يقوم موظف الإدخال في الفرع بتحديد تصنيف ونوع الطرد وكتابة أجور الشحن بحرية حسب الاتفاق مع العميل أو طبيعة المادة المنقولة، مع تدوين وزن ومواصفات الشحنة في حقل الملاحظة. تم حذف التسعير الآلي التلقائي نهائياً لعدم الحاجة إليه حالياً.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-emerald-400 font-medium">
            <span className="flex items-center gap-1">
              ✓ حقل أجور شحن يدوي مباشر
            </span>
            <span className="flex items-center gap-1">
              ✓ قائمة أنواع الطرود المعتمدة
            </span>
            <span className="flex items-center gap-1">
              ✓ تدوين وزن وملاحظات الشحنة
            </span>
            <span className="flex items-center gap-1">
              ✓ خيارات العملة المزدوجة (ل.س / $)
            </span>
          </div>
        </div>
      </div>

      {/* Package Types Management - قائمة أنواع الطرود المعتمدة */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">
                    قائمة أنواع الطرود المعتمدة في إدخال البيانات
                  </h3>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {packageTypes.length} أنواع متاحة
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  هذه القائمة تظهر تلقائياً في شاشة إدخال البيانات وتسجيل الشحنات لدى كافة الفروع
                </p>
              </div>
            </div>

            {/* + Button to Add New Package Type */}
            <button
              type="button"
              onClick={() => setShowAddTypeInput(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="إضافة نوع طرد جديد"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة نوع طرد جديد</span>
            </button>
          </div>

          {/* Package Type Mode Selector (اختيار آلية كتابة وإدخال نوع الطرد) */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-emerald-300 block">آلية إدخال نوع الطرد في شاشة إستقبال الطرود:</span>
              <span className="text-[11px] text-slate-400">حدد ما إذا كان الموظف يكتب نوع الطرد يدوياً أم يختاره من القائمة المعتمدة</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => updateBrandingSettings({ packageTypeMode: 'manual_text' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  (brandingSettings.packageTypeMode || 'manual_text') === 'manual_text'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>✍️ كتابة نوع الطرد يدوياً (حقل نصي حر)</span>
              </button>

              <button
                type="button"
                onClick={() => updateBrandingSettings({ packageTypeMode: 'directory_dropdown' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  brandingSettings.packageTypeMode === 'directory_dropdown'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📋 اختيار من قائمة الدليل المضافة</span>
              </button>
            </div>
          </div>

          {/* Action / Notification Alert */}
          {typeActionMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{typeActionMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setTypeActionMessage(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Inline Add Input Field (عند الضغط على الزر +) */}
          {showAddTypeInput && (
            <form
              onSubmit={handleAddNewPackageType}
              className="p-4 rounded-xl bg-slate-950 border border-emerald-500/60 shadow-inner flex flex-col gap-3 animate-in fade-in"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم نوع الطرد الجديد *</label>
                  <input
                    type="text"
                    value={newPackageTypeName}
                    onChange={(e) => setNewPackageTypeName(e.target.value)}
                    placeholder="مثال: طرد هش / قابل للكسر، مواد غذائية..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-emerald-400 focus:outline-none placeholder-slate-500"
                    autoFocus
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">أجور مثبتة (ل.س)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newTypePriceSyp}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => setNewTypePriceSyp(sanitizeDecimal(e.target.value))}
                    placeholder="مثال: 25000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-emerald-400 focus:outline-none placeholder-slate-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-amber-300 mb-1 flex items-center gap-1">
                    <span>حد أدنى للتعديل (ل.س)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newTypeMinPriceSyp}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => setNewTypeMinPriceSyp(sanitizeDecimal(e.target.value))}
                    placeholder="مثال: 20000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-200 text-xs font-semibold focus:border-amber-400 focus:outline-none placeholder-slate-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">أجور مثبتة ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newTypePriceUsd}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => setNewTypePriceUsd(sanitizeDecimal(e.target.value))}
                    placeholder="مثال: 3"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-emerald-400 focus:outline-none placeholder-slate-500 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-amber-300 mb-1">حد أدنى للتعديل ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newTypeMinPriceUsd}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => setNewTypeMinPriceUsd(sanitizeDecimal(e.target.value))}
                    placeholder="مثال: 2.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-200 text-xs font-semibold focus:border-amber-400 focus:outline-none placeholder-slate-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span>💡 عند تحديد "حد أدنى للتعديل"، لن يسمح البرنامج بتسجيل الشحنة إذا كانت أجورها أقل من هذا الحد.</span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="submit"
                    disabled={!newPackageTypeName.trim()}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة وتثبيت في القائمة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTypeInput(false);
                      setNewPackageTypeName('');
                      setNewTypePriceSyp('');
                      setNewTypePriceUsd('');
                      setNewTypeMinPriceSyp('');
                      setNewTypeMinPriceUsd('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Package Types Badges / Grid with Fixed Pricing Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {packageTypes.map((type, idx) => {
              const rateInfo = brandingSettings.packageTypeRates?.[type];
              const hasFixedPrice =
                rateInfo &&
                ((rateInfo.fixedPriceSyp && rateInfo.fixedPriceSyp > 0) ||
                  (rateInfo.fixedPriceUsd && rateInfo.fixedPriceUsd > 0));
              const hasMinPrice =
                rateInfo &&
                ((rateInfo.minPriceSyp && rateInfo.minPriceSyp > 0) ||
                  (rateInfo.minPriceUsd && rateInfo.minPriceUsd > 0));

              return (
                <div
                  key={idx}
                  className={`flex flex-col justify-between p-3 rounded-xl border transition group shadow-sm ${
                    hasFixedPrice || hasMinPrice
                      ? 'bg-slate-950/90 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasFixedPrice ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      ></span>
                      <span className="text-xs font-bold text-slate-100 truncate" title={type}>
                        {type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePackageType(type)}
                      title={`حذف نوع الطرد [${type}]`}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition opacity-60 group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Fixed Price & Min Limit Badges */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                    {hasFixedPrice || hasMinPrice ? (
                      <div className="space-y-1">
                        {hasFixedPrice && (
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0 text-emerald-300 font-mono font-bold text-[11px]">
                            <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {rateInfo?.fixedPriceSyp ? `${formatNumber(rateInfo.fixedPriceSyp)} ل.س` : ''}
                              {rateInfo?.fixedPriceSyp && rateInfo?.fixedPriceUsd ? ' / ' : ''}
                              {rateInfo?.fixedPriceUsd ? `$${rateInfo.fixedPriceUsd}` : ''}
                            </span>
                          </div>
                        )}
                        {hasMinPrice && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-300 font-mono bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded">
                            <span className="font-sans font-bold text-amber-400">حد أدنى للتعديل:</span>
                            <span>
                              {rateInfo?.minPriceSyp ? `${formatNumber(rateInfo.minPriceSyp)} ل.س` : ''}
                              {rateInfo?.minPriceSyp && rateInfo?.minPriceUsd ? ' / ' : ''}
                              {rateInfo?.minPriceUsd ? `$${rateInfo.minPriceUsd}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px] flex items-center gap-1">
                        <span className="opacity-60">أجور حرة / غير مقيدة</span>
                      </span>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenRateEditor(type)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                          hasFixedPrice || hasMinPrice
                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={`ضبط وتحديد الأجور والحد الأدنى لـ [${type}]`}
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>{hasFixedPrice || hasMinPrice ? 'تعديل الأجور والحدود' : 'ربط سعر وحد أدنى'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal / Dialog for Editing Fixed Price for a Package Type */}
          {editingRateType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">ربط أجور شحن وضوابط الحد الأدنى لنوع الطرد</h3>
                      <p className="text-[11px] text-emerald-400 font-semibold">{editingRateType}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingRateType(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed space-y-1">
                  <p>
                    💡 <strong>الأجور المثبتة:</strong> تُدرج تلقائياً في خانة أجور الشحن عند اختيار <strong>[{editingRateType}]</strong>.
                  </p>
                  <p className="text-amber-300">
                    🛡️ <strong>الحد الأدنى للتعديل:</strong> في حال رغب موظف الاستلام بتعديل الأجور يدوياً، يمنع النظام إنقاصها عن هذا الحد الأدنى (مثل: سعر مثبت 25,000 وحد أدنى 20,000 ل.س).
                  </p>
                </div>

                <form onSubmit={handleSaveRateEditor} className="space-y-3">
                  {/* SYP Group */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <span className="text-[11px] font-bold text-emerald-400 block">تعرفة الليرة السورية (SYP):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          أجور الشحن المثبتة (SYP)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editRateSyp}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => setEditRateSyp(sanitizeDecimal(e.target.value))}
                            placeholder="مثال: 25000"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold font-mono focus:border-emerald-400 focus:outline-none"
                            autoFocus
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">ل.س</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-300 mb-1">
                          الحد الأدنى للتعديل (SYP)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editMinRateSyp}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => setEditMinRateSyp(sanitizeDecimal(e.target.value))}
                            placeholder="مثال: 20000"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/60 text-amber-200 text-xs font-bold font-mono focus:border-amber-400 focus:outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-amber-400 font-bold">ل.س</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* USD Group */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <span className="text-[11px] font-bold text-cyan-400 block">تعرفة الدولار الأمريكي (USD):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          أجور الشحن المثبتة (USD)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editRateUsd}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => setEditRateUsd(sanitizeDecimal(e.target.value))}
                            placeholder="مثال: 3"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold font-mono focus:border-cyan-400 focus:outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-slate-500 font-bold">$</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-300 mb-1">
                          الحد الأدنى للتعديل (USD)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editMinRateUsd}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => setEditMinRateUsd(sanitizeDecimal(e.target.value))}
                            placeholder="مثال: 2.5"
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/60 text-amber-200 text-xs font-bold font-mono focus:border-amber-400 focus:outline-none"
                          />
                          <span className="absolute left-2.5 top-2 text-[10px] text-amber-400 font-bold">$</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleClearRate(editingRateType)}
                      className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-bold transition cursor-pointer"
                    >
                      تصفير (جعلها حرة)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRateType(null)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30"
                      >
                        <Check className="w-4 h-4" />
                        <span>حفظ وتثبيت الأجور والضوابط</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Footer Notes & Reset Defaults */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>هذه الأسماء تُحفظ وتظهر فوراً في القائمة المنسدلة لشاشة إدخال البيانات عند تسجيل الطرد.</span>
            </span>
            <button
              type="button"
              onClick={handleResetDefaultTypes}
              className="text-cyan-400 hover:text-cyan-300 font-medium underline cursor-pointer self-end sm:self-auto"
            >
              استعادة الأنواع الافتراضية (8)
            </button>
          </div>
        </div>

      {/* ID Document Types Management - قائمة أنواع وثائق الهوية المعتمدة */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  قائمة أنواع وثائق الهوية المعتمدة في النظام
                </h3>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {idDocumentTypes.length} أنواع وثائق متاحة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد القائمة المنسدلة لأنواع الوثائق (هوية سورية، هوية فلسطيني، حكومة إنقاذ، جواز سفر، إخراج قيد...) الظاهرة في واجهة تسجيل الطرود
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddIdDocTypeInput(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            title="إضافة نوع وثيقة جديد"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة نوع وثيقة جديد</span>
          </button>
        </div>

        {/* Action / Notification Alert */}
        {idDocTypeActionMsg && (
          <div className="p-3 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{idDocTypeActionMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setIdDocTypeActionMsg(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Input for Adding New Document Type */}
        {showAddIdDocTypeInput && (
          <form onSubmit={handleAddIdDocType} className="bg-slate-950 p-4 rounded-xl border border-cyan-500/50 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> إضافة نوع وثيقة جديد إلى القائمة
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAddIdDocTypeInput(false);
                  setNewIdDocTypeInput('');
                }}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newIdDocTypeInput}
                onChange={(e) => setNewIdDocTypeInput(e.target.value)}
                placeholder="اسم وثيقة الهوية (مثال: هوية سورية، هوية فلسطيني، حكومة إنقاذ، جواز سفر...)"
                className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                autoFocus
                required
              />
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>حفظ وإضافة الوثيقة</span>
              </button>
            </div>
          </form>
        )}

        {/* Grid Display of Configured Document Types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {idDocumentTypes.map((type, idx) => {
            const isEditing = editingIdDocTypeIdx === idx;
            return (
              <div
                key={`${type}-${idx}`}
                className="bg-slate-950/90 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-3 flex items-center justify-between gap-2 transition group shadow-xs"
              >
                {isEditing ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      type="text"
                      value={editingIdDocTypeName}
                      onChange={(e) => setEditingIdDocTypeName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-cyan-500 text-white text-xs rounded-lg px-2 py-1 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEditIdDocType(idx)}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                      title="حفظ التعديل"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIdDocTypeIdx(null);
                        setEditingIdDocTypeName('');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                      title="إلغاء"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>
                      <span className="text-xs font-bold text-white truncate" title={type}>
                        {type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIdDocTypeIdx(idx);
                          setEditingIdDocTypeName(type);
                        }}
                        className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/50 rounded-lg transition cursor-pointer"
                        title="تعديل اسم الوثيقة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {idDocumentTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIdDocType(type)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                          title="حذف نوع الوثيقة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info & Restore Defaults button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>هذه الأنواع تظهر فوراً في القائمة المنسدلة (نوع الوثيقة) جانب حقل القراءة وفي نموذج إدخال الطرد.</span>
          </span>
          <button
            type="button"
            onClick={handleResetDefaultIdDocTypes}
            className="text-cyan-400 hover:text-cyan-300 font-medium underline cursor-pointer self-end sm:self-auto"
          >
            استعادة الأنواع الافتراضية ({DEFAULT_ID_DOCUMENT_TYPES.length})
          </button>
        </div>
      </div>

      {/* Remittance Commission & COD Transfer Engine Section (محرك تعرفة وعمولة الحوالات المالية) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>تعرفة وعمولة الحوالات المالية وخدمة التحصيل ضد الدفع (COD)</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                  {getCodCommissionLabel(liveSimulatedCodSettings, 'SYP')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  مربوط بالقسم المالي والطرود
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تحديد آلية احتساب عمولة الحوالات النقدية: كنسبة مئوية أو مبلغ مقطوع لكل شريحة مبلغ (احتساب نسبي تلقائي لأي مبلغ مثل 5 مليون أو 3 ونصف مليون).
              </p>
            </div>
          </div>

          {currentUser?.role === 'super_admin' && (
            <button
              type="button"
              onClick={() => setActiveModule('cashbox')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto shrink-0"
              title="الانتقال إلى الصناديق والقسم المالي لمطابقة العمولات"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>عرض القسم المالي والخزينة</span>
            </button>
          )}
        </div>

        {/* Calculation Mode Selection Tabs */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            طريقة احتساب عمولة الحوالة المالية المعتمدة:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Mode 1: Custom Brackets (عمولة تبعاً لشرائح) */}
            <div
              onClick={() => handleSelectCommissionMode('custom_brackets')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                commissionMode === 'custom_brackets'
                  ? 'bg-amber-950/40 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                commissionMode === 'custom_brackets'
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'border-slate-600 bg-slate-900'
              }`}>
                {commissionMode === 'custom_brackets' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-white">عمولة تبعاً لشرائح (من كذا لـ كذا)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    جديد
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تسجيل شرائح متدرجة مخصصة: من مبلغ كذا إلى مبلغ كذا عمولتها كذا، مع إضافة شرائح جديدة ديناميكياً.
                </p>
              </div>
            </div>

            {/* Mode 2: Per Amount Tier (مبلغ لكل شريحة مبلغ) */}
            <div
              onClick={() => handleSelectCommissionMode('per_amount_tier')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                commissionMode === 'per_amount_tier'
                  ? 'bg-amber-950/40 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                commissionMode === 'per_amount_tier'
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'border-slate-600 bg-slate-900'
              }`}>
                {commissionMode === 'per_amount_tier' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-white">مبلغ مقطوع لكل شريحة (نسبي)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                    تناسبي تلقائي
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  تحديد عمولة محددة لكل شريحة مبلغ (مثلاً: 8,000 ل.س لكل 1,000,000 ل.س تناسبياً).
                </p>
              </div>
            </div>

            {/* Mode 3: Percentage (نسبة مئوية) */}
            <div
              onClick={() => handleSelectCommissionMode('percentage')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                commissionMode === 'percentage'
                  ? 'bg-amber-950/40 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                commissionMode === 'percentage'
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'border-slate-600 bg-slate-900'
              }`}>
                {commissionMode === 'percentage' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">نسبة مئوية ثابتة (%)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  احتساب عمولة التحويل كنسبة مئوية محددة من إجمالي مبلغ الحوالة المالية المسجلة (مثلاً: 2%).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Settings Fields Based on Mode */}
        {commissionMode === 'custom_brackets' ? (
          /* Custom Brackets Builder Component */
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/90 border border-amber-500/40 space-y-4">
            {/* Header & Currency Switcher Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  جدول شرائح عمولة الحوالات المتدرجة:
                </h3>
              </div>

              {/* Currency Toggle Buttons */}
              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSwitchBracketCurrency('SYP')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBracketCurrency === 'SYP'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>شرائح الليرة السورية ({bracketsSyp.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchBracketCurrency('USD')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBracketCurrency === 'USD'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>شرائح الدولار ({bracketsUsd.length})</span>
                </button>
              </div>
            </div>

            {/* Bracket Creation Form (حقول من - إلى - العمولة مع فتح حقل جديد عند الحفظ) */}
            <form onSubmit={handleAddBracket} className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>تسجيل وإضافة شريحة جديدة ({activeBracketCurrency === 'SYP' ? 'ليرة سورية SYP' : 'دولار أمريكي USD'})</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  عند الحفظ يتم فتح حقول الشريحة التالية تلقائياً
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* From Amount */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-slate-300 mb-1 font-semibold">
                    من مبلغ (الحد الأدنى):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={newBracketFrom}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => setNewBracketFrom(sanitizeDecimal(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:border-amber-500 focus:outline-none"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      {activeBracketCurrency === 'SYP' ? 'ل.س' : '$'}
                    </span>
                  </div>
                </div>

                {/* To Amount */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] text-slate-300 mb-1 font-semibold">
                    إلى مبلغ (الحد الأعلى للشريحة):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={newBracketTo}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => setNewBracketTo(sanitizeDecimal(e.target.value))}
                      placeholder={activeBracketCurrency === 'SYP' ? 'مثلاً: 500000' : 'مثلاً: 50'}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:border-amber-500 focus:outline-none"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      {activeBracketCurrency === 'SYP' ? 'ل.س' : '$'}
                    </span>
                  </div>
                </div>

                {/* Commission Fee */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-amber-300 mb-1 font-semibold">
                    قيمة العمولة المستحقة:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={newBracketFee}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => setNewBracketFee(sanitizeDecimal(e.target.value))}
                      placeholder={activeBracketCurrency === 'SYP' ? 'مثلاً: 3000' : 'مثلاً: 1'}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/80 text-amber-300 font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 font-bold">
                      {activeBracketCurrency === 'SYP' ? 'ل.س' : '$'}
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>حفظ الشريحة</span>
                  </button>
                </div>
              </div>

              {bracketValidationError && (
                <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold">
                  ⚠️ {bracketValidationError}
                </div>
              )}

              {bracketSuccessMsg && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{bracketSuccessMsg}</span>
                </div>
              )}
            </form>

            {/* List of Defined Brackets Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>الشرائح المعتمدة حالياً لعملة ({activeBracketCurrency === 'SYP' ? 'الليرة السورية' : 'الدولار الأمريكي'}):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetDefaultBrackets(activeBracketCurrency)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>استعادة الشرائح المقترحة</span>
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => handleClearAllBrackets(activeBracketCurrency)}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>تفريغ الكل</span>
                  </button>
                </div>
              </div>

              {(activeBracketCurrency === 'SYP' ? bracketsSyp : bracketsUsd).length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">لا توجد أي شرائح مسجلة لهذه العملة بعد.</p>
                  <button
                    type="button"
                    onClick={() => handleResetDefaultBrackets(activeBracketCurrency)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تحميل الشرائح النموذجية الجاهزة</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="p-2.5 text-center w-12">#</th>
                        <th className="p-2.5">من مبلغ</th>
                        <th className="p-2.5">إلى مبلغ</th>
                        <th className="p-2.5 text-amber-300">العمولة المستحقة</th>
                        <th className="p-2.5 text-slate-400">متوسط النسبة التقديرية</th>
                        <th className="p-2.5 text-center w-20">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 font-mono">
                      {(activeBracketCurrency === 'SYP' ? bracketsSyp : bracketsUsd).map((bracket, idx) => {
                        const midPoint = (bracket.fromAmount + bracket.toAmount) / 2;
                        const approxPercent = midPoint > 0 ? ((bracket.fee / midPoint) * 100).toFixed(2) : '0';
                        return (
                          <tr key={bracket.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="p-2.5 text-center text-slate-500 font-bold">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-white">
                              {formatCurrency(bracket.fromAmount, activeBracketCurrency)}
                            </td>
                            <td className="p-2.5 font-bold text-white">
                              {formatCurrency(bracket.toAmount, activeBracketCurrency)}
                            </td>
                            <td className="p-2.5 font-black text-amber-300">
                              {formatCurrency(bracket.fee, activeBracketCurrency)}
                            </td>
                            <td className="p-2.5 text-slate-400 text-[11px]">
                              تقريباً ~{approxPercent}%
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteBracket(bracket.id, activeBracketCurrency)}
                                className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 transition cursor-pointer"
                                title="حذف هذه الشريحة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : commissionMode === 'per_amount_tier' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            {/* SYP Tier Config */}
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/60">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>شريحة الليرة السورية (SYP)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatCurrency(tierFeeSyp, 'SYP')} / {formatCurrency(tierAmountSyp, 'SYP')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    لكل شريحة مبلغ:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tierAmountSypStr}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        isCodDirtyRef.current = true;
                        const clean = sanitizeDecimal(e.target.value);
                        setTierAmountSypStr(clean);
                        setTierAmountSyp(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:border-amber-500 focus:outline-none"
                      placeholder="أدخل مبلغ الشريحة"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      ل.س
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    قيمة العمولة المستحقة:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tierFeeSypStr}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        isCodDirtyRef.current = true;
                        const clean = sanitizeDecimal(e.target.value);
                        setTierFeeSypStr(clean);
                        setTierFeeSyp(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/80 text-amber-300 font-mono font-bold text-xs focus:border-amber-400 focus:outline-none"
                      placeholder="أدخل قيمة العمولة"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 font-bold">
                      ل.س
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/90 border border-amber-500/20 text-[11px] text-amber-200/90 font-mono leading-relaxed">
                قاعدة الاحتساب: كل <strong>{formatCurrency(tierAmountSyp, 'SYP')}</strong> تكون عمولتها <strong>{formatCurrency(tierFeeSyp, 'SYP')}</strong> (نسبة <strong>{tierAmountSyp > 0 ? ((tierFeeSyp / tierAmountSyp) * 100).toFixed(2) : 0}%</strong> تلقائياً).
              </div>
            </div>

            {/* USD Tier Config */}
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/60">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>شريحة الدولار الأمريكي (USD)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ${tierFeeUsd} / ${tierAmountUsd}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    لكل شريحة مبلغ:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tierAmountUsdStr}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        isCodDirtyRef.current = true;
                        const clean = sanitizeDecimal(e.target.value);
                        setTierAmountUsdStr(clean);
                        setTierAmountUsd(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs focus:border-emerald-500 focus:outline-none"
                      placeholder="أدخل مبلغ الشريحة"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      $
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    قيمة العمولة المستحقة:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tierFeeUsdStr}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        isCodDirtyRef.current = true;
                        const clean = sanitizeDecimal(e.target.value);
                        setTierFeeUsdStr(clean);
                        setTierFeeUsd(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-emerald-500/80 text-emerald-300 font-mono font-bold text-xs focus:border-emerald-400 focus:outline-none"
                      placeholder="أدخل قيمة العمولة"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-bold">
                      $
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/90 border border-emerald-500/20 text-[11px] text-emerald-200/90 font-mono leading-relaxed">
                قاعدة الاحتساب: كل <strong>{formatCurrency(tierAmountUsd, 'USD')}</strong> تكون عمولتها <strong>{formatCurrency(tierFeeUsd, 'USD')}</strong> (نسبة <strong>{tierAmountUsd > 0 ? ((tierFeeUsd / tierAmountUsd) * 100).toFixed(2) : 0}%</strong> تلقائياً).
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="max-w-xs">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                نسبة العمولة المئوية العامة (%):
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={transferFeePercentStr}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    isCodDirtyRef.current = true;
                    const clean = sanitizeDecimal(e.target.value);
                    setTransferFeePercentStr(clean);
                    setTransferFeePercent(clean === '' ? 0 : parseFloat(clean) || 0);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-500 text-white font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                  placeholder="أدخل نسبة العمولة %"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-bold font-mono">
                  %
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              تُحسب العمولة تلقائياً بضرب مبلغ الحوالة في النسبة المحددة أعلاه وتُطبق على كافة الحوالات بالليرة السورية أو الدولار.
            </p>
          </div>
        )}

        {/* Safety Minimums & Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <label className="block text-[11px] text-slate-400">الحد الأدنى للعمولة (ل.س):</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={minTransferFeeSypStr}
                onFocus={(e) => e.target.select()}
                onKeyDown={blockNonAmountKeys}
                onChange={(e) => {
                  isCodDirtyRef.current = true;
                  const clean = sanitizeDecimal(e.target.value);
                  setMinTransferFeeSypStr(clean);
                  setMinTransferFeeSyp(clean === '' ? 0 : parseFloat(clean) || 0);
                }}
                placeholder="أدخل الحد الأدنى"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ل.س</span>
            </div>
            <span className="text-[10px] text-slate-500 block">حماية لتغطية الحوالات الصغيرة</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <label className="block text-[11px] text-slate-400">الحد الأدنى للعمولة ($):</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={minTransferFeeUsdStr}
                onFocus={(e) => e.target.select()}
                onKeyDown={blockNonAmountKeys}
                onChange={(e) => {
                  isCodDirtyRef.current = true;
                  const clean = sanitizeDecimal(e.target.value);
                  setMinTransferFeeUsdStr(clean);
                  setMinTransferFeeUsd(clean === '' ? 0 : parseFloat(clean) || 0);
                }}
                placeholder="أدخل الحد الأدنى"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
            </div>
            <span className="text-[10px] text-slate-500 block">حد أدنى للحوالات بالدولار</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <label className="block text-[11px] text-slate-400">سقف الحوالة المسموح (ل.س):</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={maxCodAllowedSypStr}
                onFocus={(e) => e.target.select()}
                onKeyDown={blockNonAmountKeys}
                onChange={(e) => {
                  isCodDirtyRef.current = true;
                  const clean = sanitizeDecimal(e.target.value);
                  setMaxCodAllowedSypStr(clean);
                  setMaxCodAllowedSyp(clean === '' ? 0 : parseFloat(clean) || 0);
                }}
                placeholder="أدخل سقف الحوالة"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ل.س</span>
            </div>
            <span className="text-[10px] text-slate-500 block">أقصى مبلغ للحوالة الواحدة</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <label className="block text-[11px] text-slate-400">سقف الحوالة المسموح ($):</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={maxCodAllowedUsdStr}
                onFocus={(e) => e.target.select()}
                onKeyDown={blockNonAmountKeys}
                onChange={(e) => {
                  isCodDirtyRef.current = true;
                  const clean = sanitizeDecimal(e.target.value);
                  setMaxCodAllowedUsdStr(clean);
                  setMaxCodAllowedUsd(clean === '' ? 0 : parseFloat(clean) || 0);
                }}
                placeholder="أدخل سقف الحوالة"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
            </div>
            <span className="text-[10px] text-slate-500 block">أقصى مبلغ بالدولار</span>
          </div>
        </div>

        {/* Live Remittance Commission Simulator & Tester */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>حاسبة المحاكاة والاختبار الفوري لعمولة الحوالة (Live Tester)</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              التعرفة المطبقة حالياً: {getCodCommissionLabel(liveSimulatedCodSettings, simCurrency)}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            {/* Amount input & currency toggle */}
            <div className="space-y-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-300 font-medium">مبلغ الحوالة التجريبي:</label>
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSimCurrency('SYP')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                      simCurrency === 'SYP' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ل.س
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimCurrency('USD')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                      simCurrency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    $
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={simAmountInput}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => handleSimAmountChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/80 text-amber-300 font-mono font-bold text-base focus:border-amber-400 focus:outline-none"
                  placeholder="أدخل مبلغ الحوالة"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-bold font-mono">
                  {simCurrency === 'SYP' ? 'ل.س' : '$'}
                </span>
              </div>

              {/* Quick Click Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                <span className="text-slate-500">مبالغ سريعة:</span>
                <button
                  type="button"
                  onClick={() => handleSetQuickSimAmount(1000000, 'SYP')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 cursor-pointer font-mono"
                >
                  1 مليون
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickSimAmount(3500000, 'SYP')}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer font-mono font-bold"
                  title="المبلغ المذكور في طلبك (3 ونصف مليون)"
                >
                  3.5 مليون ★
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickSimAmount(5000000, 'SYP')}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer font-mono font-bold"
                  title="المبلغ المذكور في طلبك (5 مليون)"
                >
                  5 مليون ★
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickSimAmount(10000000, 'SYP')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 cursor-pointer font-mono"
                >
                  10 مليون
                </button>
                <button
                  type="button"
                  onClick={() => handleSetQuickSimAmount(100, 'USD')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 cursor-pointer font-mono"
                >
                  100 $
                </button>
              </div>
            </div>

            {/* Live Calculation Results Breakdown */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block">مبلغ الحوالة الأصلي:</span>
                <span className="font-mono text-sm font-bold text-white">
                  {formatCurrency(simAmount, simCurrency)}
                </span>
                {liveMatchedBracket && commissionMode === 'custom_brackets' && (
                  <span className="text-[9px] text-cyan-300 font-mono block">
                    الشريحة: {formatCurrency(liveMatchedBracket.fromAmount, simCurrency)} - {formatCurrency(liveMatchedBracket.toAmount, simCurrency)}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 bg-amber-500/10 p-2 rounded-lg border border-amber-500/30">
                <span className="text-[10px] text-amber-300 font-bold block flex items-center justify-between">
                  <span>العمولة المحسوبة:</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
                <span className="font-mono text-base font-black text-amber-300 block">
                  {formatCurrency(liveCalculatedFee, simCurrency)}
                </span>
                <span className="text-[9px] text-amber-400/80 font-mono block">
                  المكافئ: {simAmount > 0 ? ((liveCalculatedFee / simAmount) * 100).toFixed(2) : 0}%
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 block">المبلغ المحول للمرسل:</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {formatCurrency(simAmount, simCurrency)}
                </span>
                <span className="text-[9px] text-slate-500 block">يصل للمرسل كاملاً</span>
              </div>

              <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  إجمالي المطلوب قبضه من المستلم (الحوالة + العمولة):
                </span>
                <span className="font-black text-amber-200 bg-amber-950/80 px-2.5 py-1 rounded-md border border-amber-600/40">
                  {formatCurrency(simAmount + liveCalculatedFee, simCurrency)}
                  <span className="text-[10px] font-normal text-slate-400 mr-1.5">(+ أجور الشحن)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save & Confirm Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCodSettings}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs rounded-xl shadow-lg shadow-amber-600/30 flex items-center gap-2 transition transform active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وتثبيت تعرفة عمولة الحوالات المركزية</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تسري التعرفة فوراً على كافة الفروع وشاشات إدخال الطرود والصناديق.</span>
          </div>
        </div>

        {/* Success Alert */}
        {codSaveSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              تم حفظ وتطبيق تعرفة عمولة الحوالات المالية بنجاح (
              <strong className="font-mono">{getCodCommissionLabel(liveSimulatedCodSettings, 'SYP')}</strong>
              ) وتم ربطها فوراً بالقسم المالي وإدخال الطرود.
            </span>
          </div>
        )}
      </div>

      {/* Number Formatting & Decimals System (نظام التحكم بإظهار الأرقام والكسور والفواصل في كامل التطبيق) */}
      <NumberFormatEngineControls />

      {/* Multi-Currency Delivery Policy Card (سياسة تعدد العملات وقبض الطرود عند التسليم) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 border ${
              allowMultiCurrencyDelivery
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>خيار السماح بتعدد العملات في تسليم الطرود (سياسة القبض بالصناديق)</span>
                </h2>
                {allowMultiCurrencyDelivery ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>مسموح بتعدد العملات والتحويل</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>مقفل (إلزام القبض المنفصل لكل عملة)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديد هل يُسمح للمستلم بالتحويل والسداد بكلا العملتين أو ليرة أو دولار، أم يُمنع الاستقبال إلا بشكل منفصل بحيث تحافظ كل عملة على عملتها.
              </p>
            </div>
          </div>
        </div>

        {/* Policy Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Strictly Separate Collection (Locked - Default) */}
          <div
            onClick={() => handleToggleMultiCurrencyDelivery(false)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              !allowMultiCurrencyDelivery
                ? 'bg-amber-950/30 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    !allowMultiCurrencyDelivery
                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                      : 'border-slate-600 bg-slate-900'
                  }`}>
                    {!allowMultiCurrencyDelivery && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="font-bold text-sm text-white">🔒 قفل الخيار: إلزام القبض المنفصل لكل عملة</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  الموصى به لمنع خلط العملات
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يمنع استقبال العملات إلا بشكل منفصل. يقفل خيار تحديد نوع القبض وتحافظ كل عملة على عملتها الأصلية (أجور الشحن بالليرة تسدد بالليرة، ومبلغ الحوالة بالدولار يسدد بالدولار).
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>تأثيره في واجهة التسليم:</span>
                </div>
                <div className="text-slate-400 text-[10.5px]">
                  تُخفى خيارات تحديد نوع القبض (كل عملة بعملتها / سداد كامل بالليرة / سداد كامل بالدولار) نهائياً، ويظهر فقط <strong className="text-amber-200">شرط التسليم</strong> ويُلزم الموظف بقبض كل عملة بصندوقها الخاص.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMultiCurrencyDelivery(false);
              }}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                !allowMultiCurrencyDelivery
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <span>اعتماد القبض المنفصل وحجب خيارات التحويل</span>
              {!allowMultiCurrencyDelivery && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Option 2: Allow Multi-Currency & Conversion */}
          <div
            onClick={() => handleToggleMultiCurrencyDelivery(true)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              allowMultiCurrencyDelivery
                ? 'bg-cyan-950/30 border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    allowMultiCurrencyDelivery
                      ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                      : 'border-slate-600 bg-slate-900'
                  }`}>
                    {allowMultiCurrencyDelivery && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="font-bold text-sm text-white">🔓 السماح بتعدد العملات والتحويل عند التسليم</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  مرونة سداد
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يسمح للمستلم بالاختيار بين السداد بكل عملة بعملتها، أو سداد كامل المبلغ بالليرة السورية، أو سداد كامل المبلغ بالدولار الأمريكي.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-[11px] text-cyan-300 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>تأثيره في واجهة التسليم:</span>
                </div>
                <div className="text-slate-400 text-[10.5px]">
                  تظهر أزرار تحديد نوع القبض (كل عملة بعملتها / سداد كامل بالليرة / سداد كامل بالدولار) ويتاح تحويل المقبوض للصندوق المختار.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMultiCurrencyDelivery(true);
              }}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                allowMultiCurrencyDelivery
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <span>السماح بتعدد العملات وإظهار خيارات السداد</span>
              {allowMultiCurrencyDelivery && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Currency Policy Save Success Banner */}
        {currencyPolicySavedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              تم حفظ وتطبيق سياسة قبض العملات فوراً: {allowMultiCurrencyDelivery ? 'السماح بتعدد العملات والتحويل' : 'إقفال خيارات التحويل وإلزام القبض المنفصل'}.
            </span>
          </div>
        )}
      </div>

      {/* System-wide Scope Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Package className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>تسليم وتصفية الطرود</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            تحصيل قيمة الطرود وأجور الشحن والحوالات المسجلة بالدولار عند الدفع أو الاستلام بالليرة السورية.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>الصناديق النقدية للفروع</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            مطابقة إيرادات الصناديق بالعملة المزدوجة وإظهار المكافئ المالي الإجمالي لخزينة كل فرع بدقة.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
            <span>سندات المصاريف والوقود</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            معادلة فواتير الوقود والمشتريات التشغيلية التي يتم دفعها أو تقييدها بالدولار الأمريكي.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>التقارير الموحدة للإدارة</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            توحيد كشوفات الأرباح والخسائر والمطالبات بين شبكة الفروع الـ 14 تحت معيار حسابي مركزي.
          </p>
        </div>
      </div>
    </div>
  );
};
