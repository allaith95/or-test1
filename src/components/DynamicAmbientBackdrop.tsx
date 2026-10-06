import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActiveModule } from '../context/OrcaContext';

interface DynamicAmbientBackdropProps {
  activeModule: ActiveModule;
  isDesktopVisible: boolean;
}

interface ModuleThemeConfig {
  primaryGlow: string;
  secondaryGlow: string;
  accentBeam: string;
  blob1Pos: { top: string; right: string };
  blob2Pos: { bottom: string; left: string };
}

const MODULE_THEMES: Record<string, ModuleThemeConfig> = {
  desktop: {
    primaryGlow: 'rgba(245, 186, 19, 0.12)', // Warm Gold
    secondaryGlow: 'rgba(217, 119, 6, 0.10)', // Amber
    accentBeam: 'from-amber-500/25 via-orange-500/15 to-transparent',
    blob1Pos: { top: '-10%', right: '15%' },
    blob2Pos: { bottom: '-15%', left: '10%' },
  },
  dashboard: {
    primaryGlow: 'rgba(245, 186, 19, 0.14)', // Warm Gold
    secondaryGlow: 'rgba(6, 182, 212, 0.10)', // Cyan
    accentBeam: 'from-amber-400/25 via-cyan-500/15 to-transparent',
    blob1Pos: { top: '-5%', right: '20%' },
    blob2Pos: { bottom: '-10%', left: '15%' },
  },
  intake: {
    primaryGlow: 'rgba(16, 185, 129, 0.14)', // Emerald
    secondaryGlow: 'rgba(245, 186, 19, 0.10)', // Gold
    accentBeam: 'from-emerald-400/25 via-amber-500/15 to-transparent',
    blob1Pos: { top: '-8%', right: '10%' },
    blob2Pos: { bottom: '-5%', left: '25%' },
  },
  manifests: {
    primaryGlow: 'rgba(245, 158, 11, 0.16)', // Express Amber
    secondaryGlow: 'rgba(234, 88, 12, 0.12)', // Sunset Orange
    accentBeam: 'from-amber-400/30 via-orange-500/20 to-transparent',
    blob1Pos: { top: '-12%', right: '25%' },
    blob2Pos: { bottom: '-10%', left: '12%' },
  },
  arrivals: {
    primaryGlow: 'rgba(79, 70, 229, 0.14)', // Indigo
    secondaryGlow: 'rgba(245, 186, 19, 0.10)', // Gold
    accentBeam: 'from-indigo-400/25 via-amber-500/15 to-transparent',
    blob1Pos: { top: '-5%', right: '12%' },
    blob2Pos: { bottom: '-15%', left: '20%' },
  },
  delivery: {
    primaryGlow: 'rgba(139, 92, 246, 0.14)', // Violet
    secondaryGlow: 'rgba(245, 186, 19, 0.10)', // Gold
    accentBeam: 'from-purple-400/25 via-amber-500/15 to-transparent',
    blob1Pos: { top: '-10%', right: '18%' },
    blob2Pos: { bottom: '-8%', left: '15%' },
  },
  cashbox: {
    primaryGlow: 'rgba(16, 185, 129, 0.16)', // Emerald Gold
    secondaryGlow: 'rgba(245, 186, 19, 0.12)', // Warm Gold
    accentBeam: 'from-emerald-400/25 via-amber-400/20 to-transparent',
    blob1Pos: { top: '-6%', right: '22%' },
    blob2Pos: { bottom: '-12%', left: '18%' },
  },
  pricing: {
    primaryGlow: 'rgba(6, 182, 212, 0.14)', // Cyan / Teal
    secondaryGlow: 'rgba(245, 186, 19, 0.10)', // Gold
    accentBeam: 'from-cyan-400/25 via-amber-400/15 to-transparent',
    blob1Pos: { top: '-10%', right: '15%' },
    blob2Pos: { bottom: '-10%', left: '20%' },
  },
  master_admin: {
    primaryGlow: 'rgba(245, 186, 19, 0.16)', // Sovereignty Gold
    secondaryGlow: 'rgba(225, 29, 72, 0.12)', // Crimson
    accentBeam: 'from-amber-400/30 via-rose-500/20 to-transparent',
    blob1Pos: { top: '-5%', right: '15%' },
    blob2Pos: { bottom: '-15%', left: '22%' },
  },
};

export const DynamicAmbientBackdrop: React.FC<DynamicAmbientBackdropProps> = React.memo(
  ({ activeModule, isDesktopVisible }) => {
    const themeKey = isDesktopVisible ? 'desktop' : activeModule || 'dashboard';
    const currentTheme = useMemo(
      () => MODULE_THEMES[themeKey] || MODULE_THEMES.desktop,
      [themeKey]
    );

    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none transform-gpu"
      >
        {/* 1. Dusk Sunset Gradient Atmosphere Layer (Inspired by Land Transport scene) */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#0a0d16] to-[#06080e]" />

        {/* 2. Horizon Sunset Warm Glow Band across middle/lower section */}
        <div className="absolute inset-x-0 bottom-1/4 h-80 bg-gradient-to-t from-amber-500/[0.04] via-orange-600/[0.03] to-transparent blur-3xl pointer-events-none" />

        {/* 3. Subtle Animated Highway Light Streaks (Representing Express Freight Corridors) */}
        <div className="absolute inset-0 opacity-[0.14] overflow-hidden">
          <svg
            className="w-full h-full"
            viewBox="0 0 1600 900"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="roadGlowAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F5BA13" stopOpacity="0" />
                <stop offset="30%" stopColor="#F5BA13" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#FF8C00" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="roadGlowCyan" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
                <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Arterial Highway Curve 1 (Damascus - Homs - Aleppo main express artery) */}
            <path
              d="M -100,850 C 400,800 700,650 1100,520 C 1350,440 1500,380 1700,350"
              fill="none"
              stroke="url(#roadGlowAmber)"
              strokeWidth="3"
              strokeDasharray="16 8"
              className="animate-pulse"
            />

            {/* Arterial Highway Curve 2 (Coastal - Central artery) */}
            <path
              d="M -50,600 C 350,580 650,520 1000,480 C 1300,450 1550,420 1700,400"
              fill="none"
              stroke="url(#roadGlowCyan)"
              strokeWidth="2"
              strokeDasharray="24 12"
            />

            {/* Arterial Highway Curve 3 (Eastern route to Deir ez-Zor) */}
            <path
              d="M 200,900 C 600,750 1000,620 1400,560 C 1550,540 1650,520 1750,500"
              fill="none"
              stroke="url(#roadGlowAmber)"
              strokeWidth="1.5"
              strokeDasharray="10 6"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* 4. Top Edge Subtle Ambient Light Beam */}
        <div className="absolute top-0 inset-x-0 h-px">
          <div
            className={`w-full h-full bg-gradient-to-r ${currentTheme.accentBeam} transition-all duration-1000 ease-out`}
          />
        </div>

        {/* 5. Animated Floating Ambient Mesh Blobs */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`ambient_mesh_${themeKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            {/* Ambient Blob 1 (Top-Right / Primary Tone) */}
            <div
              style={{
                top: currentTheme.blob1Pos.top,
                right: currentTheme.blob1Pos.right,
                backgroundColor: currentTheme.primaryGlow,
              }}
              className="absolute w-[45vw] max-w-[600px] h-[45vw] max-h-[600px] rounded-full blur-3xl transform-gpu pointer-events-none opacity-80"
            />

            {/* Ambient Blob 2 (Bottom-Left / Secondary Tone) */}
            <div
              style={{
                bottom: currentTheme.blob2Pos.bottom,
                left: currentTheme.blob2Pos.left,
                backgroundColor: currentTheme.secondaryGlow,
              }}
              className="absolute w-[40vw] max-w-[500px] h-[40vw] max-h-[500px] rounded-full blur-3xl transform-gpu pointer-events-none opacity-70"
            />
          </motion.div>
        </AnimatePresence>

        {/* 6. Dark Shading Overlay & Vignette (مظلله قليلا لضمان وضوح العناصر والنوافذ) */}
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/40 to-slate-950/80" />
      </div>
    );
  }
);
