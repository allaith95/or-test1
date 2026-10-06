import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface WaybillQRCodeProps {
  value: string;
  size?: number;
  className?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
}

/**
 * Universal High-Precision QR Code Generator
 * Generates razor-sharp, pure vector SVG QR code with crisp edges and proper quiet zone.
 * Designed specifically for instant, error-free scanning by all smartphone cameras
 * (iPhone iOS Camera, Android Camera, Google Lens) and 2D industrial barcode scanners.
 */
export const WaybillQRCode: React.FC<WaybillQRCodeProps> = ({
  value,
  size = 80,
  className = '',
  errorCorrectionLevel = 'M',
  margin = 2,
}) => {
  const cleanValue = useMemo(() => {
    if (!value || !value.trim()) return 'ORCA-EXPRESS';
    return value.trim();
  }, [value]);

  // Synchronous, pure vector SVG generation - no canvas downsampling or raster blur
  const qrSvgData = useMemo(() => {
    try {
      const qr = QRCode.create(cleanValue, { errorCorrectionLevel });
      const moduleCount = qr.modules.size;
      const qz = Math.max(1, margin);
      const total = moduleCount + qz * 2;
      let pathD = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            pathD += `M${c + qz},${r + qz}h1v1h-1z `;
          }
        }
      }
      return { total, pathD };
    } catch (err) {
      console.error('QR code generation error:', err);
      return null;
    }
  }, [cleanValue, errorCorrectionLevel, margin]);

  if (!qrSvgData) {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white border border-black text-black font-mono text-[9px] font-bold ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        QR
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center bg-white p-0.5 select-none print-color-exact ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      title="رمز QR يتضمن بيانات البوليصة للتحقق بكاميرا الموبايل"
    >
      <svg
        viewBox={`0 0 ${qrSvgData.total} ${qrSvgData.total}`}
        width={size}
        height={size}
        className="block w-full h-full select-none print-color-exact"
        shapeRendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100%" height="100%" fill="#ffffff" />
        <path fill="#000000" d={qrSvgData.pathD} />
      </svg>
    </div>
  );
};
