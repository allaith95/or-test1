import React, { useState } from 'react';
import { Branch } from '../types';
import { OrcaLogo } from './OrcaLogo';

interface GovernorateNode {
  id: string;
  nameAr: string;
  nameEn: string;
  x: number;
  y: number;
  isHub: boolean;
}

// 1. Precise Authentic Syrian Geographic Coordinate Mapping (Optimized for 1000x800 viewBox)
const GOVERNORATES: GovernorateNode[] = [
  { id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', x: 300, y: 560, isHub: true },
  { id: 'rural_damascus', nameAr: 'ريف دمشق', nameEn: 'Rif Dimashq', x: 345, y: 520, isHub: false },
  { id: 'homs', nameAr: 'حمص', nameEn: 'Homs', x: 380, y: 430, isHub: true },
  { id: 'hama', nameAr: 'حماة', nameEn: 'Hama', x: 390, y: 350, isHub: true },
  { id: 'aleppo', nameAr: 'حلب', nameEn: 'Aleppo', x: 440, y: 220, isHub: true },
  { id: 'idlib', nameAr: 'إدلب', nameEn: 'Idlib', x: 355, y: 250, isHub: false },
  { id: 'latakia', nameAr: 'اللاذقية', nameEn: 'Latakia', x: 275, y: 320, isHub: true },
  { id: 'tartus', nameAr: 'طرطوس', nameEn: 'Tartus', x: 285, y: 410, isHub: false },
  { id: 'daraa', nameAr: 'درعا', nameEn: 'Daraa', x: 290, y: 670, isHub: false },
  { id: 'suwayda', nameAr: 'السويداء', nameEn: 'As-Suwayda', x: 360, y: 670, isHub: false },
  { id: 'quneitra', nameAr: 'القنيطرة', nameEn: 'Quneitra', x: 250, y: 600, isHub: false },
  { id: 'palmyra', nameAr: 'تدمر', nameEn: 'Palmyra', x: 520, y: 450, isHub: false },
  { id: 'raqqa', nameAr: 'الرقة', nameEn: 'Ar-Raqqah', x: 580, y: 260, isHub: false },
  { id: 'deir_ezzor', nameAr: 'دير الزور', nameEn: 'Deir ez-Zor', x: 720, y: 380, isHub: true },
  { id: 'hasakah', nameAr: 'الحسكة', nameEn: 'Al-Hasakah', x: 770, y: 200, isHub: false },
  { id: 'qamishli', nameAr: 'القامشلي', nameEn: 'Qamishli', x: 830, y: 140, isHub: true },
];

// 2. Trunk Freight Logistics Highway Corridors between Hubs
const HIGHWAY_ROUTES = [
  { from: 'damascus', to: 'rural_damascus', major: true },
  { from: 'damascus', to: 'daraa', major: true },
  { from: 'damascus', to: 'suwayda', major: true },
  { from: 'damascus', to: 'quneitra', major: true },
  { from: 'damascus', to: 'homs', major: true },
  { from: 'homs', to: 'tartus', major: true },
  { from: 'tartus', to: 'latakia', major: true },
  { from: 'latakia', to: 'idlib', major: true },
  { from: 'homs', to: 'palmyra', major: true },
  { from: 'homs', to: 'hama', major: true },
  { from: 'hama', to: 'aleppo', major: true },
  { from: 'hama', to: 'idlib', major: false },
  { from: 'idlib', to: 'aleppo', major: true },
  { from: 'aleppo', to: 'raqqa', major: true },
  { from: 'raqqa', to: 'deir_ezzor', major: true },
  { from: 'raqqa', to: 'hasakah', major: true },
  { from: 'hasakah', to: 'qamishli', major: true },
  { from: 'palmyra', to: 'deir_ezzor', major: true },
];

interface SyriaLogisticsNetworkMapProps {
  branches?: Branch[];
  activeBranchId?: string;
  onSelectBranch?: (branch: Branch) => void;
  className?: string;
  showHeaderLogo?: boolean;
  showBadges?: boolean;
  showLegend?: boolean;
  isBackgroundMode?: boolean;
}

export const SyriaLogisticsNetworkMap: React.FC<SyriaLogisticsNetworkMapProps> = ({
  className = '',
  showHeaderLogo = false,
  showBadges = false,
  showLegend = false,
  isBackgroundMode = false,
}) => {
  const [hoveredNode, setHoveredNode] = useState<GovernorateNode | null>(null);

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden ${className}`}>
      
      {/* 1. PURE BORDERLESS SVG LOGISTICS NETWORK (NO COUNTRY BORDER / NO BOXING FRAME) */}
      <svg
        viewBox="0 0 1000 800"
        className="w-full h-full max-h-[750px] object-contain drop-shadow-[0_0_50px_rgba(245,186,19,0.08)]"
        style={{ filter: 'drop-shadow(0 0 35px rgba(16, 185, 129, 0.05))' }}
      >
        <defs>
          {/* Glowing Gradients */}
          <linearGradient id="routeGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#F5BA13" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="routeGradPassive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1E293B" stopOpacity="0.2" />
          </linearGradient>

          {/* Node Glow Filters */}
          <filter id="hubGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="orcaGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Subtle Background Grid Coordinates */}
        <g opacity="0.12" stroke="#475569" strokeWidth="0.5" strokeDasharray="3 6">
          <line x1="150" y1="100" x2="150" y2="750" />
          <line x1="350" y1="100" x2="350" y2="750" />
          <line x1="550" y1="100" x2="550" y2="750" />
          <line x1="750" y1="100" x2="750" y2="750" />
          <line x1="100" y1="200" x2="900" y2="200" />
          <line x1="100" y1="400" x2="900" y2="400" />
          <line x1="100" y1="600" x2="900" y2="600" />
        </g>

        {/* 2. LOGISTICS HIGHWAY ROUTES (Connected Paths between Hubs) */}
        <g className="routes-layer">
          {HIGHWAY_ROUTES.map((route, idx) => {
            const fromGov = GOVERNORATES.find((g) => g.id === route.from);
            const toGov = GOVERNORATES.find((g) => g.id === route.to);
            if (!fromGov || !toGov) return null;

            return (
              <g key={`route-${idx}`}>
                {/* Background Shadow Line */}
                <line
                  x1={fromGov.x}
                  y1={fromGov.y}
                  x2={toGov.x}
                  y2={toGov.y}
                  stroke="#020617"
                  strokeWidth={route.major ? 6 : 4}
                  strokeLinecap="round"
                  opacity="0.8"
                />

                {/* Primary Neon Route Line */}
                <line
                  x1={fromGov.x}
                  y1={fromGov.y}
                  x2={toGov.x}
                  y2={toGov.y}
                  stroke={route.major ? 'url(#routeGradActive)' : 'url(#routeGradPassive)'}
                  strokeWidth={route.major ? 2.5 : 1.5}
                  strokeDasharray={route.major ? '8 6' : '4 4'}
                  strokeLinecap="round"
                  opacity={route.major ? 0.85 : 0.45}
                />

                {/* Pulsing Light Particles along Major Highways */}
                {route.major && (
                  <circle r="3.5" fill="#F5BA13" filter="url(#hubGlow)">
                    <animateMotion
                      path={`M ${fromGov.x},${fromGov.y} L ${toGov.x},${toGov.y}`}
                      dur={`${5 + (idx % 4)}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </g>

        {/* 3. FLOATING OFFICIAL ORCA LOGO BADGE IN THE DESERT / CENTRAL AREA */}
        <g transform="translate(560, 520)" className="pointer-events-none">
          {/* Subtle Ambient Radial Glow */}
          <circle r="65" fill="#F5BA13" opacity="0.06" filter="url(#orcaGlowFilter)" />
          <circle r="46" fill="#020617" stroke="#F5BA13" strokeWidth="1.5" opacity="0.85" />
          
          {/* Orca Logo Vector centered */}
          <g transform="translate(-28, -28)">
            <foreignObject width="56" height="56">
              <div className="w-full h-full flex items-center justify-center">
                <OrcaLogo size={50} showText={false} circularBg={false} />
              </div>
            </foreignObject>
          </g>

          <text
            x="0"
            y="64"
            textAnchor="middle"
            fill="#F5BA13"
            fontSize="11"
            fontWeight="900"
            letterSpacing="2"
            fontFamily="monospace"
            className="select-none"
          >
            ORCA EXPRESS
          </text>
        </g>

        {/* 4. GOVERNORATE NODES (Floating Clean Cities without Borders) */}
        <g className="governorates-layer">
          {GOVERNORATES.map((gov) => {
            const isHovered = hoveredNode?.id === gov.id;

            return (
              <g
                key={gov.id}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredNode(gov)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Outer Ring Pulse for Central Hubs */}
                {gov.isHub && (
                  <circle
                    cx={gov.x}
                    cy={gov.y}
                    r={isHovered ? 26 : 20}
                    fill="none"
                    stroke="#F5BA13"
                    strokeWidth="1.5"
                    opacity={isHovered ? 0.8 : 0.3}
                    className="transition-all duration-300"
                  >
                    <animate
                      attributeName="r"
                      values={isHovered ? '20;32;20' : '14;24;14'}
                      dur="3s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.4;0.05;0.4"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Main Node Circle */}
                <circle
                  cx={gov.x}
                  cy={gov.y}
                  r={isHovered ? 9 : gov.isHub ? 7.5 : 5.5}
                  fill={gov.isHub ? '#D97706' : '#334155'}
                  stroke={isHovered ? '#FFFFFF' : '#F5BA13'}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  filter={gov.isHub || isHovered ? 'url(#hubGlow)' : undefined}
                  className="transition-all duration-200"
                />

                {/* Inner Core Light */}
                <circle
                  cx={gov.x}
                  cy={gov.y}
                  r={isHovered ? 3.5 : 2.5}
                  fill="#FFFFFF"
                  opacity={gov.isHub ? 0.9 : 0.5}
                />

                {/* Arabic Governorate Name Label (Floating cleanly without borders) */}
                <text
                  x={gov.x}
                  y={gov.y - (gov.isHub ? 14 : 11)}
                  textAnchor="middle"
                  className="font-bold text-[13px] select-none pointer-events-none transition-colors duration-200"
                  fill={isHovered ? '#FCD34D' : '#E2E8F0'}
                  style={{
                    fontFamily: 'Cairo, system-ui, sans-serif',
                    textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 15px rgba(15,23,42,0.8)',
                  }}
                >
                  {gov.nameAr}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
