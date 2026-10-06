import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Lock } from 'lucide-react';
import {
  toLatinDigits,
  isoToDMY,
  dmyToISO,
  normalizeDateString,
} from '../utils/birthDateUtility';

export interface BirthDateFieldProps {
  id?: string;
  value: string; // ISO (YYYY-MM-DD) or DMY (DD/MM/YYYY)
  onChange: (isoValue: string, dmyValue: string) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  isLocked?: boolean;
  hasError?: boolean;
  className?: string;
  placeholder?: string;
  showCalendarPicker?: boolean;
}

export const BirthDateField: React.FC<BirthDateFieldProps> = ({
  id = 'input_birth_date',
  value,
  onChange,
  required = false,
  disabled = false,
  readOnly = false,
  isLocked = false,
  hasError = false,
  className = '',
  placeholder = 'اليوم/الشهر/السنة (مثال: 15/08/1990)',
  showCalendarPicker = true,
}) => {
  // Local display state to allow standard typing without cursor jumping
  const [typedText, setTypedText] = useState<string>(() => isoToDMY(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Sync internal display text with prop value when not actively typing/focused
  useEffect(() => {
    if (!isFocused) {
      const formatted = isoToDMY(value);
      setTypedText(formatted);
    }
  }, [value, isFocused]);

  // Clean, natural typing without cursor manipulation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || readOnly || disabled) return;

    let raw = toLatinDigits(e.target.value);
    // Allow numbers, slashes, dashes, dots
    raw = raw.replace(/[^0-9\/\-\.]/g, '').slice(0, 10);

    setTypedText(raw);

    // If complete date entered (10 chars or valid parsing), convert to ISO
    const parsed = normalizeDateString(raw);
    if (parsed.iso && parsed.iso.length === 10) {
      onChange(parsed.iso, parsed.dmy);
    } else {
      onChange(raw, raw);
    }
  };

  // On blur: format neatly into DD/MM/YYYY
  const handleBlur = () => {
    setIsFocused(false);
    if (!typedText.trim()) return;

    const parsed = normalizeDateString(typedText);
    if (parsed.dmy) {
      setTypedText(parsed.dmy);
      onChange(parsed.iso, parsed.dmy);
    }
  };

  // Calendar picker selection
  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedIso = e.target.value; // YYYY-MM-DD
    if (pickedIso) {
      const dmy = isoToDMY(pickedIso);
      setTypedText(dmy);
      onChange(pickedIso, dmy);
    }
  };

  const currentPickerIso = dmyToISO(typedText) || dmyToISO(value) || '';

  return (
    <div className="relative flex items-center w-full">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        required={required}
        readOnly={readOnly || isLocked}
        disabled={disabled}
        value={typedText}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        title="تاريخ الولادة: اليوم/الشهر/السنة (مثال: 15/08/1990)"
        className={`w-full bg-slate-950 border text-xs font-mono px-3 py-2 rounded-xl transition-colors focus:outline-none ${
          isLocked
            ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
            : hasError
            ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
            : 'border-slate-700 text-white focus:border-cyan-400'
        } ${showCalendarPicker ? 'pr-9' : ''} ${className}`}
      />

      {/* Calendar picker button */}
      {showCalendarPicker && !isLocked && !readOnly && !disabled && (
        <div className="absolute right-2 flex items-center justify-center">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (datePickerRef.current) {
                if (typeof datePickerRef.current.showPicker === 'function') {
                  datePickerRef.current.showPicker();
                } else {
                  datePickerRef.current.click();
                }
              }
            }}
            className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="اختيار من التقويم"
          >
            <Calendar className="w-4 h-4" />
          </button>

          <input
            ref={datePickerRef}
            type="date"
            value={currentPickerIso}
            onChange={handleCalendarChange}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      )}

      {isLocked && (
        <div className="absolute right-2 flex items-center pointer-events-none">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      )}
    </div>
  );
};

export default BirthDateField;
