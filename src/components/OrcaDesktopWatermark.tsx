import React, { useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';

export const OrcaDesktopWatermark: React.FC = () => {
  let appBackgroundUrl: string | undefined;

  try {
    const { brandingSettings } = useOrca();
    appBackgroundUrl = brandingSettings?.appBackgroundUrl;
  } catch {
    // fallback if outside context
  }

  // Syrian Governorates and Main Freight Hubs (Authentic Geographic Coordinates 1000x800 viewBox)
  const syrianHubNodes = useMemo(
    () => [
      { id: 'damascus', name: 'دمشق', x: 320, y: 560, isHub: true, color: '#F5BA13' },
      { id: 'homs', name: 'حمص', x: 380, y: 430, isHub: true, color: '#F5BA13' },
      { id: 'hama', name: 'حماة', x: 390, y: 360, isHub: false, color: '#F5BA13' },
      { id: 'aleppo', name: 'حلب', x: 440, y: 240, isHub: true, color: '#F5BA13' },
      { id: 'idlib', name: 'إدلب', x: 360, y: 260, isHub: false, color: '#F5BA13' },
      { id: 'latakia', name: 'اللاذقية', x: 280, y: 330, isHub: true, color: '#F5BA13' },
      { id: 'tartus', name: 'طرطوس', x: 290, y: 420, isHub: false, color: '#F5BA13' },
      { id: 'raqqa', name: 'الرقة', x: 570, y: 280, isHub: false, color: '#F5BA13' },
      { id: 'deir', name: 'دير الزور', x: 700, y: 380, isHub: true, color: '#F5BA13' },
      { id: 'hasakah', name: 'الحسكة', x: 760, y: 220, isHub: false, color: '#F5BA13' },
      { id: 'qamishli', name: 'القامشلي', x: 815, y: 165, isHub: true, color: '#F5BA13' },
      { id: 'daraa', name: 'درعا', x: 310, y: 660, isHub: false, color: '#F5BA13' },
      { id: 'suwayda', name: 'السويداء', x: 370, y: 660, isHub: false, color: '#F5BA13' },
      { id: 'quneitra', name: 'القنيطرة', x: 270, y: 600, isHub: false, color: '#F5BA13' },
      { id: 'palmyra', name: 'تدمر', x: 510, y: 460, isHub: false, color: '#F5BA13' },
    ],
    []
  );

  // Pure Land Transport Corridors (Direct Highways between Governorates)
  const freightCorridors = useMemo(
    () => [
      // Central Highway: Damascus <-> Homs <-> Hama <-> Aleppo
      { id: 'm5_central', path: 'M 320,560 L 380,430 L 390,360 L 440,240' },
      // Coastal Corridor: Homs <-> Tartus <-> Latakia
      { id: 'm1_coastal', path: 'M 380,430 L 290,420 L 280,330' },
      // Northern Link: Latakia <-> Idlib <-> Aleppo
      { id: 'm4_north', path: 'M 280,330 L 360,260 L 440,240' },
      // Eastern Highway: Homs <-> Palmyra <-> Deir ez-Zor
      { id: 'm20_east', path: 'M 380,430 L 510,460 L 700,380' },
      // Euphrates / Jazira Corridor: Aleppo <-> Raqqa <-> Deir ez-Zor <-> Hasakah <-> Qamishli
      { id: 'jazira_line', path: 'M 440,240 L 570,280 L 700,380 L 760,220 L 815,165' },
      // Southern Highway: Damascus <-> Daraa & Suwayda & Quneitra
      { id: 'south_line', path: 'M 320,560 L 310,660 M 320,560 L 370,660 M 320,560 L 270,600' },
    ],
    []
  );

  return (
    <div
      id="orca_desktop_background_watermark"
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Custom app background wallpaper if configured */}
      {appBackgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 transition-opacity duration-700 pointer-events-none"
          style={{ backgroundImage: `url(${appBackgroundUrl})` }}
        />
      )}

      {/* 2. Subtle Warm Dusk Atmosphere */}
      <div className="absolute w-[800px] sm:w-[1100px] h-[450px] bg-gradient-to-t from-amber-500/[0.07] via-orange-600/[0.03] to-transparent rounded-full blur-[160px] transform translate-y-36" />

      {/* 3. Geographic Syria Map with Land Transport Freight Animations */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.25] p-4">
        <svg
          viewBox="0 0 1000 800"
          className="w-full max-w-[1400px] h-full max-h-[880px]"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="transportGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Syria Land Fill Gradient */}
            <radialGradient id="syriaMapFill" cx="45%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#0f172a" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#090d16" stopOpacity="0.9" />
            </radialGradient>

            {/* Glowing Border Gradient for Syria */}
            <linearGradient id="syriaBorderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5BA13" stopOpacity="0.85" />
              <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.65" />
              <stop offset="70%" stopColor="#D97706" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Authentic Geographic Outline of Syria (Border Silhouette) */}
          <path
            d="M 270,600
               C 255,620 260,650 280,680
               C 300,705 340,715 390,700
               C 425,690 450,670 480,650
               C 520,620 570,580 620,530
               C 665,485 710,430 750,370
               C 785,320 830,250 860,190
               C 875,160 865,145 840,150
               C 800,160 750,185 700,200
               C 650,210 590,215 530,220
               C 470,225 420,230 380,240
               C 340,250 310,270 290,295
               C 275,315 270,340 272,370
               C 275,400 285,430 285,460
               C 285,490 275,520 270,550
               C 265,575 268,590 270,600 Z"
            fill="url(#syriaMapFill)"
            stroke="url(#syriaBorderGlow)"
            strokeWidth="3.2"
            strokeLinejoin="round"
            filter="drop-shadow(0 0 15px rgba(245,186,19,0.25))"
          />

          {/* Static Transport Road Lines */}
          <g opacity="0.6">
            {freightCorridors.map((c) => (
              <path
                key={c.id}
                d={c.path}
                fill="none"
                stroke="#F5BA13"
                strokeWidth="2.2"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Simple & Clean Land Transport Freight Movement Animation along Main Syrian Routes */}
          {/* Central Route Truck Pulse (Damascus <-> Aleppo) */}
          <circle r="4.5" fill="#F5BA13" filter="url(#transportGlow)">
            <animateMotion
              path="M 320,560 L 380,430 L 390,360 L 440,240"
              dur="6s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Coastal Route Truck Pulse (Homs <-> Latakia) */}
          <circle r="4" fill="#F5BA13" filter="url(#transportGlow)">
            <animateMotion
              path="M 380,430 L 290,420 L 280,330"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Eastern Route Truck Pulse (Homs <-> Deir ez-Zor) */}
          <circle r="4" fill="#F5BA13" filter="url(#transportGlow)">
            <animateMotion
              path="M 380,430 L 510,460 L 700,380"
              dur="7s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Connected Syrian Freight Hub Nodes */}
          {syrianHubNodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={node.isHub ? 14 : 9}
                fill="none"
                stroke="#F5BA13"
                strokeWidth="1"
                opacity="0.3"
                className="animate-ping origin-center"
              />
              <circle
                r={node.isHub ? 6.5 : 4}
                fill="#F5BA13"
                filter="url(#transportGlow)"
              />
              <text
                y={node.isHub ? 19 : 15}
                textAnchor="middle"
                fill="#F1F5F9"
                fontSize={node.isHub ? 12.5 : 10}
                fontWeight={node.isHub ? '900' : '700'}
                fontFamily="system-ui, 'Cairo', sans-serif"
                opacity="0.9"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
              >
                {node.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 4. Dark Vignette & Shading Mask (مظلله قليلا لضمان وضوح وراحة العين) */}
      <div className="absolute inset-0 bg-radial from-transparent via-slate-950/25 to-slate-950/70 pointer-events-none" />
    </div>
  );
};
