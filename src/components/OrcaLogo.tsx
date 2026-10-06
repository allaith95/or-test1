import React from 'react';
import { useOrca } from '../context/OrcaContext';
import officialColorLogo from '../assets/images/orca_express_logo_1789468188740.jpg';
import officialPrintBwLogo from '../assets/images/orca_print_bw.png';

export interface OrcaLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom' | number;
  showText?: boolean;
  monochrome?: boolean; // For black & white thermal receipt and document printing
  inverted?: boolean;
  circularBg?: boolean;
  customLogoUrl?: string; // Optional custom override
  purpose?: 'app' | 'print' | 'any'; // 'app' uses logoUrl, 'print' uses printLogoUrl
}

export const OrcaLogo: React.FC<OrcaLogoProps> = ({
  className = '',
  size = 'md',
  monochrome = false,
  customLogoUrl,
  purpose = 'any',
}) => {
  let contextLogoUrl: string | undefined;
  let contextPrintLogoUrl: string | undefined;

  try {
    const { brandingSettings } = useOrca();
    contextLogoUrl = brandingSettings?.logoUrl;
    contextPrintLogoUrl = brandingSettings?.printLogoUrl;
  } catch {
    // In case used outside provider
  }

  // Determine active logo URL without alteration
  const isPrintMode = purpose === 'print' || monochrome;
  let resolvedUrl: string = isPrintMode ? officialPrintBwLogo : officialColorLogo;

  if (customLogoUrl) {
    resolvedUrl = customLogoUrl;
  } else if (isPrintMode) {
    resolvedUrl = contextPrintLogoUrl || officialPrintBwLogo;
  } else {
    resolvedUrl = contextLogoUrl || officialColorLogo;
  }

  // Size styling
  let inlineStyle: React.CSSProperties = {};
  let sizeClass = '';

  if (typeof size === 'number') {
    inlineStyle = { width: `${size}px`, height: `${size}px` };
  } else {
    const sizeClasses: Record<string, string> = {
      xs: 'w-8 h-8',
      sm: 'w-11 h-11',
      md: 'w-16 h-16 sm:w-20 sm:h-20',
      lg: 'w-28 h-28 sm:w-32 sm:h-32',
      xl: 'w-40 h-40 sm:w-48 sm:h-48',
      custom: '',
    };
    sizeClass = sizeClasses[size] || 'w-16 h-16 sm:w-20 sm:h-20';
  }

  const fallback = isPrintMode ? officialPrintBwLogo : officialColorLogo;

  return (
    <div
      className={`inline-flex items-center justify-center select-none overflow-hidden ${sizeClass} ${className}`}
      style={inlineStyle}
    >
      <img
        src={resolvedUrl}
        alt="شعار أوركا إكسبريس للشحن البري"
        className="w-full h-full object-contain"
        onError={(e) => {
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
      />
    </div>
  );
};
