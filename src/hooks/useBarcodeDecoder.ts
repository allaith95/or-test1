import { useEffect, useRef } from 'react';
import { parseSyrianSmartIdBarcode, DecodedSmartIdData } from '../utils/BarcodeDecoderHook';

export interface UseBarcodeDecoderOptions {
  /** Callback fired when a barcode is successfully captured and decoded */
  onScan: (data: DecodedSmartIdData) => void;
  /** Whether the global keypress listener is active (default: true) */
  enabled?: boolean;
  /** Max time in ms between keypresses to consider as scanner input (default: 40ms) */
  timeThresholdMs?: number;
  /** Minimum buffer length to trigger barcode parsing (default: 8 chars) */
  minLength?: number;
}

/**
 * Custom React Hook: useBarcodeDecoder
 * High-performance, non-blocking global keypress buffer for Honeywell Xenon scanners.
 * Transliterates keyboard layout mismatches, cleans noise, and triggers callback on scan.
 */
export function useBarcodeDecoder({
  onScan,
  enabled = true,
  timeThresholdMs = 40,
  minLength = 8
}: UseBarcodeDecoderOptions) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier control keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
        return;
      }

      const activeElem = document.activeElement;
      const isInputFocused = activeElem && (
        activeElem.tagName === 'INPUT' ||
        activeElem.tagName === 'TEXTAREA' ||
        (activeElem as HTMLElement).isContentEditable
      );

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key -> End of Scanner Stream
      if (e.key === 'Enter' || e.keyCode === 13) {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();

          const rawBuffer = bufferRef.current;
          bufferRef.current = '';
          if (timeoutRef.current) clearTimeout(timeoutRef.current);

          const decoded = parseSyrianSmartIdBarcode(rawBuffer);
          onScanRef.current(decoded);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // If keypress interval is slow (> 120ms), clear buffer
      if (timeDiff > 120 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // If user is manually typing in an active text box (typing interval > 50ms) and buffer is empty, skip buffering
      if (isInputFocused && timeDiff > 50 && bufferRef.current.length === 0) {
        return;
      }

      // Buffer single printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Fallback timer if barcode scanner doesn't emit Enter key suffix
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          const rawBuffer = bufferRef.current;
          bufferRef.current = '';
          const decoded = parseSyrianSmartIdBarcode(rawBuffer);
          onScanRef.current(decoded);
        } else {
          bufferRef.current = '';
        }
      }, 120);
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, minLength]);

  return {
    parseBarcode: parseSyrianSmartIdBarcode
  };
}

export default useBarcodeDecoder;
