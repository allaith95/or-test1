import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  FileText,
  CreditCard,
  User,
  Calendar,
  Eye,
  Edit3,
} from 'lucide-react';
import { extractIdFromImage } from '../services/ocrService';
import { ParsedSyrianId } from '../utils/syrianIdParser';
import { sanitizeDigitsOnly } from '../utils/numberSanitizer';

interface IdOcrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedData: (data: {
    firstName: string;
    fatherName: string;
    lastName: string;
    motherName: string;
    nationalId: string;
    birthDate: string;
    photoDataUrl: string;
  }) => void;
}

export const IdOcrScannerModal: React.FC<IdOcrScannerModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedData,
}) => {
  const [step, setStep] = useState<'capture' | 'processing' | 'review'>('capture');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable fields in review step
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [lastName, setLastName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [rawOcrText, setRawOcrText] = useState('');

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && step === 'capture') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, step]);

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('[IdOcrScannerModal] Camera access failed, fallback to file upload:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Image preprocessing: Grayscale + Contrast boost for higher OCR accuracy
  const preprocessImage = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Scale to maximum 1600px width for fast mobile processing
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Apply contrast enhancement (Standard GIMP/W3C formula with contrastValue in [-255, 255])
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const contrastValue = 50; // Moderate contrast boost (+50)
        const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));

        for (let i = 0; i < d.length; i += 4) {
          // Grayscale (Luminance)
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Contrast
          const adjusted = factor * (gray - 128) + 128;
          const clamped = Math.max(0, Math.min(255, adjusted));
          d[i] = clamped;
          d[i + 1] = clamped;
          d[i + 2] = clamped;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    stopCamera();
    setCapturedPhotoUrl(rawDataUrl);
    processImageWithOcr(rawDataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        stopCamera();
        setCapturedPhotoUrl(dataUrl);
        processImageWithOcr(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const processImageWithOcr = async (photoUrl: string) => {
    setStep('processing');
    setProgress(5);
    setStatusText('جاري تحسين وضوح الصورة...');
    setErrorMessage(null);

    try {
      const preprocessed = await preprocessImage(photoUrl);
      const res = await extractIdFromImage(preprocessed, (prog, text) => {
        setProgress(prog);
        setStatusText(text);
      });

      if (res.success && res.parsed) {
        setFirstName(res.parsed.firstName || '');
        setFatherName(res.parsed.fatherName || '');
        setLastName(res.parsed.lastName || '');
        setMotherName(res.parsed.motherName || '');
        setNationalId(res.parsed.nationalId || '');
        setBirthDate(res.parsed.birthDate || '');
        setConfidence(res.parsed.confidence || 0);
        setRawOcrText(res.rawText || '');
        setStep('review');
      } else {
        setErrorMessage(res.error || 'تعذر استخراج النصوص بوضوح من الصورة');
        setStep('review');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء معالجة الصورة');
      setStep('review');
    }
  };

  const handleConfirmAndApply = () => {
    onApplyExtractedData({
      firstName: firstName.trim(),
      fatherName: fatherName.trim(),
      lastName: lastName.trim(),
      motherName: motherName.trim(),
      nationalId: nationalId.trim(),
      birthDate: birthDate.trim(),
      photoDataUrl: capturedPhotoUrl,
    });
    onClose();
  };

  const handleRetake = () => {
    setStep('capture');
    setCapturedPhotoUrl('');
    setErrorMessage(null);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">الماسح الضوئي الذكي للهوية (Offline OCR)</h3>
              <p className="text-[10px] text-slate-400">معالجة محلية آمنة 100% دون إرسال الصور لأي خادم خارجي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* STEP 1: CAPTURE */}
          {step === 'capture' && (
            <div className="space-y-4">
              {typeof WebAssembly === 'undefined' && (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                  <span>
                    متصفحك القديم لا يدعم المعالجة البصرية المتقدمة (WebAssembly). يمكنك إدخال بيانات الهوية يدوياً في النموذج.
                  </span>
                </div>
              )}
              <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-dashed border-slate-700 flex items-center justify-center min-h-[280px]">
                {isCameraActive ? (
                  <>
                    <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover max-h-[380px]" />
                    {/* Card Alignment Overlay */}
                    <div className="absolute inset-4 sm:inset-10 border-2 border-amber-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-3 bg-amber-500/5">
                      <div className="text-right">
                        <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded shadow">
                          وجّه بطاقة الهوية داخل الإطار
                        </span>
                      </div>
                      <div className="text-center text-[10px] text-amber-200 bg-slate-900/80 rounded-md py-1">
                        تأكد من وضوح الإضاءة وعدم وجود انعكاسات
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">الكاميرا غير متاحة، يمكنك رفع صورة الهوية مباشرة من الملفات</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                {isCameraActive && (
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>التقاط الصورة والمسح</span>
                  </button>
                )}

                <label className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>اختيار صورة من الجهاز</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <RefreshCw className="w-16 h-16 text-amber-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-white">{statusText || 'جاري المعالجة...'}</h4>
                <div className="w-full max-w-xs mx-auto bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{progress}%</span>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW (SPLIT SCREEN) */}
          {step === 'review' && (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage} — يرجى مراجعة الحقول وإكمال النواقص يدوياً.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Photo Preview Column (Right / Top) */}
                <div className="md:col-span-5 space-y-2">
                  <span className="text-xs font-bold text-slate-300 block">الصورة الملتقطة للهوية:</span>
                  <div className="rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-[220px]">
                    <img src={capturedPhotoUrl} alt="الهوية" className="w-full h-full object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة التصوير</span>
                  </button>
                </div>

                {/* Extracted Fields Column (Left / Bottom) */}
                <div className="md:col-span-7 space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>البيانات المستخرجة (قابلة للتعديل):</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        confidence >= 70
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      دقة القراءة: {confidence}%
                    </span>
                  </div>

                  {/* Triple Names */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">الاسم:</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white ${
                          firstName ? 'border-emerald-500/50' : 'border-amber-500/50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">الأب:</label>
                      <input
                        type="text"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white ${
                          fatherName ? 'border-emerald-500/50' : 'border-amber-500/50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">الكنية:</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white ${
                          lastName ? 'border-emerald-500/50' : 'border-amber-500/50'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Mother Name & Birth Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">اسم الأم:</label>
                      <input
                        type="text"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        placeholder="اسم الأم"
                        className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white ${
                          motherName ? 'border-emerald-500/50' : 'border-slate-700'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">تاريخ الولادة:</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg px-2 py-1 text-xs text-white font-mono ${
                          birthDate ? 'border-emerald-500/50' : 'border-amber-500/50'
                        }`}
                      />
                    </div>
                  </div>

                  {/* National ID */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                      الرقم الوطني (11 رقماً):
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={nationalId}
                        onChange={(e) => setNationalId(sanitizeDigitsOnly(e.target.value))}
                        placeholder="01010101011"
                        maxLength={11}
                        dir="ltr"
                        className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs text-white font-mono ${
                          nationalId && nationalId.length === 11
                            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'border-amber-500/60 ring-1 ring-amber-500/30'
                        }`}
                      />
                      {nationalId && nationalId.length === 11 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-3 pointer-events-none" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 absolute right-3 pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
          >
            إلغاء
          </button>

          {step === 'review' && (
            <button
              type="button"
              onClick={handleConfirmAndApply}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>اعتماد وتعبئة النموذج</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
