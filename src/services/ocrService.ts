import { createWorker } from 'tesseract.js';
import { parseSyrianId, ParsedSyrianId } from '../utils/syrianIdParser';

export interface OcrExtractionResult {
  success: boolean;
  rawText: string;
  parsed: ParsedSyrianId;
  error?: string;
}

/**
 * Client-Side Offline-First OCR Service for Syrian ID Cards using Tesseract.js
 */
export async function extractIdFromImage(
  imageSource: string | HTMLCanvasElement | Blob,
  onProgress?: (progress: number, statusText: string) => void
): Promise<OcrExtractionResult> {
  let worker: any = null;
  try {
    onProgress?.(10, 'جاري تهيئة محرك المعالجة البصرية...');
    worker = await createWorker('ara', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/core',
      langPath: '/tesseract/lang-data',
      cacheMethod: 'write',
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const prog = Math.round(30 + m.progress * 65);
          onProgress?.(prog, `جاري قراءة النصوص والرموز (${Math.round(m.progress * 100)}%)...`);
        } else if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
          onProgress?.(20, 'جاري تحميل محرك وقواميس اللغة العربية محلياً...');
        }
      },
    });

    onProgress?.(30, 'بدء معالجة الصورة واستخراج الكلمات...');
    const ret = await worker.recognize(imageSource);
    const rawText = ret?.data?.text || '';

    onProgress?.(95, 'تحليل ومطابقة الحقول الرسمية للهوية...');
    const parsed = parseSyrianId(rawText);

    onProgress?.(100, 'اكتمل الاستخراج بنجاح!');
    return {
      success: true,
      rawText,
      parsed,
    };
  } catch (err: any) {
    console.error('[OCR Service] Extraction failed:', err);
    return {
      success: false,
      rawText: '',
      parsed: parseSyrianId(''),
      error: err?.message || 'فشل في قراءة بيانات الهوية من الصورة',
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}
