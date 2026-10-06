import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { toLatinDigits } from '../utils/numberFormatter';

export interface FormattedAmountInputProps {
  id?: string;
  value: number | string;
  onChange: (numericValue: number, formattedString: string) => void;
  currency?: string;
  allowDecimals?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * تنسيق القيمة الرقمية بفواصل الآلاف والملايين (1,000 - 1,000,000)
 */
export function formatValueWithCommas(
  input: string | number | null | undefined,
  allowDecimals = false
): string {
  if (input === null || input === undefined || input === '') return '';
  const str = toLatinDigits(String(input)).trim();
  if (str === '') return '';

  // السماح بالأرقام فقط والنقطة العشرية إن كانت مسموحة
  let clean = allowDecimals
    ? str.replace(/[^\d.]/g, '')
    : str.replace(/[^\d]/g, '');

  if (clean === '') return '';

  // عند وجود أكثر من نقطة عشرية، الاحتفاظ بالنقطة الأولى فقط
  if (allowDecimals) {
    const dotIndex = clean.indexOf('.');
    if (dotIndex !== -1) {
      clean = clean.slice(0, dotIndex + 1) + clean.slice(dotIndex + 1).replace(/\./g, '');
    }
  }

  const parts = clean.split('.');
  let integerPart = parts[0];
  const hasDecimal = parts.length > 1;
  const decimalPart = parts[1];

  // إزالة الأصفار الزائدة في البداية مع الحفاظ على الصفر الفردي
  if (integerPart.length > 1 && integerPart.startsWith('0')) {
    integerPart = integerPart.replace(/^0+/, '') || '0';
  }

  // إضافة فواصل الآلاف والملايين داخل الجزء الصحيح
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (hasDecimal) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

export const FormattedAmountInput: React.FC<FormattedAmountInputProps> = ({
  id,
  value,
  onChange,
  currency,
  allowDecimals,
  placeholder = '0',
  className = '',
  disabled = false,
  readOnly = false,
  autoFocus = false,
  required = false,
  name,
  onBlur,
  onFocus,
  onKeyDown,
}) => {
  // الليرة السورية لا تتضمن أجزاء عشرية افتراضياً، بينما الدولار يسمح بالأجزاء
  const isDecimalAllowed = allowDecimals !== undefined ? allowDecimals : currency === 'USD';

  // تحويل القيمة الابتدائية إلى نص منسق بفواصل الآلاف
  const getFormattedFromProp = (val: number | string): string => {
    if (val === '' || val === 0 || val === '0') {
      return '';
    }
    return formatValueWithCommas(val, isDecimalAllowed);
  };

  const [displayValue, setDisplayValue] = useState<string>(() => getFormattedFromProp(value));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cursorPosRef = useRef<number | null>(null);
  const isInternalChangeRef = useRef(false);

  // تحديث الحقل إذا تغيرت القيمة من الخارج (مثلاً أزرار الإضافة السريعة أو التصفير)
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const currentNumeric = displayValue === '' ? 0 : parseFloat(displayValue.replace(/,/g, '')) || 0;
    const propNumeric = typeof value === 'number' ? value : (parseFloat(String(value).replace(/,/g, '')) || 0);

    if (currentNumeric !== propNumeric || (value === 0 && displayValue !== '')) {
      setDisplayValue(getFormattedFromProp(value));
    }
  }, [value, isDecimalAllowed]);

  // تثبيت موضع المؤشر بدقة عند إضافة أو إزالة الفواصل لمنع القفز
  useLayoutEffect(() => {
    if (inputRef.current && cursorPosRef.current !== null) {
      const pos = Math.min(cursorPosRef.current, inputRef.current.value.length);
      inputRef.current.setSelectionRange(pos, pos);
      cursorPosRef.current = null;
    }
  }, [displayValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawInputVal = input.value;
    const oldCursor = input.selectionStart || 0;

    // احتساب عدد الأرقام والرموز غير الفاصلة قبل موضع المؤشر الحالي
    const nonCommasBefore = rawInputVal.slice(0, oldCursor).replace(/,/g, '').length;

    const formatted = formatValueWithCommas(rawInputVal, isDecimalAllowed);
    isInternalChangeRef.current = true;
    setDisplayValue(formatted);

    // حساب الموضع الجديد للمؤشر في النص المنسق ليحافظ على استمرارية الكتابة
    let newCursor = 0;
    let nonCommaCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (nonCommaCount >= nonCommasBefore) {
        newCursor = i;
        break;
      }
      if (formatted[i] !== ',') {
        nonCommaCount++;
      }
      newCursor = i + 1;
    }

    cursorPosRef.current = newCursor;

    const numericVal = formatted === '' ? 0 : parseFloat(formatted.replace(/,/g, '')) || 0;
    onChange(numericVal, formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // التعامل الذكي مع زر Backspace عند الوقوف أمام الفاصلة مباشرة
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      if (start !== null && start === end && start > 0) {
        if (input.value[start - 1] === ',') {
          e.preventDefault();
          // حذف الرقم الفعلي الذي يسبق الفاصلة وليس الفاصلة وحدها
          const before = input.value.slice(0, start - 2);
          const after = input.value.slice(start);
          const combined = before + after;
          const nonCommasBefore = before.replace(/,/g, '').length;

          const formatted = formatValueWithCommas(combined, isDecimalAllowed);
          isInternalChangeRef.current = true;
          setDisplayValue(formatted);

          let newCursor = 0;
          let count = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (count >= nonCommasBefore) {
              newCursor = i;
              break;
            }
            if (formatted[i] !== ',') count++;
            newCursor = i + 1;
          }

          cursorPosRef.current = newCursor;
          const num = formatted === '' ? 0 : parseFloat(formatted.replace(/,/g, '')) || 0;
          onChange(num, formatted);
          return;
        }
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode={isDecimalAllowed ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        if (onFocus) onFocus(e);
      }}
      onBlur={(e) => {
        if (onBlur) onBlur(e);
      }}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      required={required}
      dir="ltr"
    />
  );
};
