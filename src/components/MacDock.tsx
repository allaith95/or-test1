import React, { useState, useRef, useEffect } from 'react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import {
  LayoutDashboard,
  PackagePlus,
  Truck,
  Warehouse,
  ScanLine,
  PackageCheck,
  WalletCards,
  SlidersHorizontal,
  Users,
  Database,
  ShieldAlert,
  Receipt,
  RotateCcw,
  PanelRight,
  PanelLeft,
  PanelBottom,
  EyeOff,
  Move,
  Sparkles,
  Layers,
  MoreVertical,
  Sliders,
  Check,
  DollarSign,
} from 'lucide-react';

export type DockLayoutMode = 'bottom' | 'right' | 'left' | 'floating' | 'hidden';

interface DockItem {
  id: ActiveModule;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  badge?: number;
}

export const MacDock: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    truckManifests,
    parcels,
    settlements,
    currentBranch,
    canAccessModule,
  } = useOrca();

  // Dock Mode: 'bottom' | 'right' | 'left' | 'floating' | 'hidden'
  const [layoutMode, setLayoutMode] = useState<DockLayoutMode>('bottom');
  const [previousMode, setPreviousMode] = useState<DockLayoutMode>('bottom');
  
  // Dragging State & Position for Floating Mode
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // 3-Dot Options Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startPosX: number; startPosY: number }>({
    mouseX: 0,
    mouseY: 0,
    startPosX: 0,
    startPosY: 0,
  });
  const dockRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load saved layout mode and position on mount & notify layout
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem('orca_dock_layout_mode') as DockLayoutMode;
      if (savedMode && ['bottom', 'right', 'left', 'floating', 'hidden'].includes(savedMode)) {
        setLayoutMode(savedMode);
        if (savedMode !== 'hidden') {
          setPreviousMode(savedMode);
        }
      }

      const savedPos = safeStorage.getItem('orca_dock_pos');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPosition(parsed);
        }
      }
    } catch {
      // fallback to bottom
    }
  }, []);

  // Broadcast layout mode to document body/window for content padding adjustments
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('orca-dock-mode-change', { detail: { mode: layoutMode } }));
  }, [layoutMode]);

  // Close 3-dot dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const changeLayoutMode = (mode: DockLayoutMode) => {
    if (layoutMode !== 'hidden') {
      setPreviousMode(layoutMode);
    }
    setLayoutMode(mode);
    setIsMenuOpen(false);
    try {
      safeStorage.setItem('orca_dock_layout_mode', mode);
    } catch {
      // ignore
    }
  };

  const handleMouseDownOnHandle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const currentPosX = position ? position.x : rect.left;
    const currentPosY = position ? position.y : rect.top;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startPosX: currentPosX,
      startPosY: currentPosY,
    };
    if (layoutMode !== 'floating') {
      changeLayoutMode('floating');
    }
    setIsDragging(true);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(10, Math.min(window.innerWidth - 100, dragStartRef.current.startPosX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.startPosY + dy));

      const newPos = { x: newX, y: newY };
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (position) {
          try {
            safeStorage.setItem('orca_dock_pos', JSON.stringify(position));
          } catch {
            // ignore
          }
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  const resetDockPosition = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPosition(null);
    changeLayoutMode('bottom');
    setIsMenuOpen(false);
    try {
      safeStorage.removeItem('orca_dock_pos');
    } catch {
      // ignore
    }
  };

  // Mouse wheel scroll handler for smooth scrolling without scrollbars
  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (itemsContainerRef.current) {
      if (layoutMode === 'right' || layoutMode === 'left') {
        // Vertical scroll
        itemsContainerRef.current.scrollTop += e.deltaY;
      } else {
        // Horizontal scroll with wheel
        itemsContainerRef.current.scrollLeft += e.deltaY || e.deltaX;
      }
    }
  };

  // Badges calculation
  const incomingTrucksCount = currentBranch
    ? truckManifests.filter(
        (m) => m.destinationHubId === currentBranch.id && m.status === 'dispatched'
      ).length
    : 0;

  const overdueParcelsCount = currentBranch
    ? parcels.filter(
        (p) =>
          p.destinationHubId === currentBranch.id &&
          p.handlingStatus === 'received_at_dest' &&
          p.arrivedAtDestAt &&
          (Date.now() - new Date(p.arrivedAtDestAt).getTime()) / (1000 * 3600 * 24) > (p.storageGraceDays || 3)
      ).length
    : 0;

  const pendingSettlementsCount = currentBranch
    ? settlements.filter(
        (s) => s.parentHubId === currentBranch.id && s.status === 'pending'
      ).length
    : 0;

  const dockItems: DockItem[] = [
    {
      id: 'dashboard',
      label: 'الرئيسية والمؤشرات',
      icon: LayoutDashboard,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'intake',
      label: 'تسجيل الطرود و A4',
      icon: PackagePlus,
      color: 'from-cyan-500 to-teal-600',
    },
    {
      id: 'manifests',
      label: 'الترحيل والمانافيست',
      icon: Truck,
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'arrivals',
      label: 'مستودع الاستلام والركود',
      icon: Warehouse,
      color: 'from-violet-500 to-purple-600',
      badge: incomingTrucksCount > 0 ? incomingTrucksCount : overdueParcelsCount > 0 ? overdueParcelsCount : undefined,
    },
    {
      id: 'delivery',
      label: 'التسليم',
      icon: PackageCheck,
      color: 'from-emerald-500 to-green-600',
    },
    {
      id: 'cashbox',
      label: 'الصناديق والمقاصة',
      icon: WalletCards,
      color: 'from-sky-500 to-blue-600',
      badge: pendingSettlementsCount > 0 ? pendingSettlementsCount : undefined,
    },
    {
      id: 'expenses',
      label: 'دليل وسجل المصاريف',
      icon: Receipt,
      color: 'from-rose-500 to-orange-600',
    },
    {
      id: 'pricing',
      label: 'العملات والتسعير',
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'admin_users',
      label: 'المستخدمين والفروع',
      icon: Users,
      color: 'from-slate-600 to-slate-800',
    },
    {
      id: 'master_admin',
      label: 'لوحة الإدارة المركزية',
      icon: ShieldAlert,
      color: 'from-amber-500 via-orange-600 to-rose-600',
    },
    {
      id: 'backup_cloud',
      label: 'قاعدة البيانات والكلاود',
      icon: Database,
      color: 'from-teal-600 to-emerald-700',
    },
  ];

  const visibleDockItems = dockItems.filter((item) => canAccessModule(item.id));
  const isVertical = layoutMode === 'right' || layoutMode === 'left';

  // Dynamic Styles based on layout mode
  const getDockPositionStyles = (): React.CSSProperties => {
    if (layoutMode === 'floating' && position) {
      return {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'none',
        zIndex: 50,
      };
    }
    if (layoutMode === 'right') {
      return {
        position: 'fixed',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 45,
      };
    }
    if (layoutMode === 'left') {
      return {
        position: 'fixed',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 45,
      };
    }
    // Default Bottom
    return {
      position: 'fixed',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 45,
    };
  };

  return (
    <>
      {/* 1. Sleek Floating Animated Launcher Button (Shown when Hidden) */}
      {layoutMode === 'hidden' ? (
        <div
          id="orca-dock-launcher-btn"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 print:hidden flex items-center gap-2 select-none animate-bounce"
        >
          <button
            onClick={() => changeLayoutMode(previousMode === 'hidden' ? 'bottom' : previousMode)}
            className="group relative px-4 py-2.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl shadow-2xl shadow-cyan-500/50 border border-cyan-300/40 flex items-center gap-2.5 transition-all transform hover:scale-105 cursor-pointer"
            title="انقر لإظهار شريط الأقسام (Mac Dock)"
          >
            {/* Glowing Halo */}
            <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-40 blur-md group-hover:opacity-75 transition-opacity" />
            
            <div className="relative flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-white">
                <Layers className="w-4 h-4" />
              </div>
              <span className="tracking-wide">إظهار شريط الأقسام (Dock)</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            </div>
          </button>
        </div>
      ) : (
        /* 2. Full Dock Container */
        <div
          ref={dockRef}
          style={getDockPositionStyles()}
          className={`print:hidden select-none transition-all duration-300 ${
            isDragging ? 'cursor-grabbing opacity-90 scale-[1.02]' : ''
          }`}
        >
          <nav
            aria-label="macOS Dock"
            className={`bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/95 transition-all duration-200 ${
              isVertical
                ? 'flex flex-col items-center gap-1.5 p-2'
                : 'flex flex-row items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2'
            }`}
          >
            {/* 3-Dot Options Button & Dropdown Menu */}
            <div ref={menuRef} className="relative flex items-center justify-center">
              <button
                type="button"
                id="dock-3dot-menu-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  isMenuOpen
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
                title="خيارات وتحكم بموضع شريط الأقسام (3 نقاط)"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div
                  className={`absolute z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl p-2 shadow-2xl text-xs min-w-[200px] text-slate-200 animate-in fade-in zoom-in-95 duration-150 ${
                    layoutMode === 'right'
                      ? 'top-0 right-12'
                      : layoutMode === 'left'
                      ? 'top-0 left-12'
                      : 'bottom-12 right-0'
                  }`}
                >
                  <div className="px-2 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>موضع وعرض شريط الأقسام</span>
                    <Sliders className="w-3 h-3 text-cyan-400" />
                  </div>

                  <div className="space-y-1 mt-1">
                    {/* Option 1: Right */}
                    <button
                      onClick={() => changeLayoutMode('right')}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        layoutMode === 'right'
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PanelRight className="w-3.5 h-3.5 text-cyan-400" />
                        <span>عامودي على اليمين</span>
                      </div>
                      {layoutMode === 'right' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>

                    {/* Option 2: Left */}
                    <button
                      onClick={() => changeLayoutMode('left')}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        layoutMode === 'left'
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PanelLeft className="w-3.5 h-3.5 text-cyan-400" />
                        <span>عامودي على اليسار</span>
                      </div>
                      {layoutMode === 'left' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>

                    {/* Option 3: Bottom */}
                    <button
                      onClick={() => changeLayoutMode('bottom')}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        layoutMode === 'bottom'
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PanelBottom className="w-3.5 h-3.5 text-cyan-400" />
                        <span>أفقي بالأسفل (افتراضي)</span>
                      </div>
                      {layoutMode === 'bottom' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>

                    {/* Option 4: Drag / Float */}
                    <button
                      onMouseDown={handleMouseDownOnHandle}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-grab active:cursor-grabbing ${
                        layoutMode === 'floating'
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold'
                          : 'hover:bg-slate-800 text-slate-300 hover:text-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Move className="w-3.5 h-3.5 text-amber-400" />
                        <span>سحب حر في أي مكان</span>
                      </div>
                      {layoutMode === 'floating' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>

                    {/* Divider */}
                    <div className="border-t border-slate-800 my-1" />

                    {/* Option 5: Reset Position */}
                    <button
                      onClick={resetDockPosition}
                      className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>إعادة ضبط الموضع للمركز</span>
                    </button>

                    {/* Option 6: Hide Dock */}
                    <button
                      onClick={() => changeLayoutMode('hidden')}
                      className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>إخفاء الشريط بالكامل</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Separator Divider */}
            <div className={`bg-slate-800 ${isVertical ? 'w-full h-px my-0.5' : 'h-7 w-px mx-0.5'}`} />

            {/* Dock Items Scrollable Container (No visible scrollbar, navigable with mouse wheel) */}
            <div
              ref={itemsContainerRef}
              onWheel={handleWheelScroll}
              className={`flex items-center gap-1 sm:gap-1.5 no-scrollbar ${
                isVertical
                  ? 'flex-col max-h-[75vh] overflow-y-auto px-1 py-0.5'
                  : 'flex-row overflow-x-auto'
              }`}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {visibleDockItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;

                // Tooltip positioning depending on layout
                let tooltipClasses = '-top-9 left-1/2 -translate-x-1/2';
                if (layoutMode === 'right') {
                  tooltipClasses = 'top-1/2 -translate-y-1/2 right-12';
                } else if (layoutMode === 'left') {
                  tooltipClasses = 'top-1/2 -translate-y-1/2 left-12';
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveModule(item.id)}
                    className="group relative flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-xl transition-all duration-200 focus:outline-none cursor-pointer"
                  >
                    {/* Tooltip on Hover */}
                    <div
                      className={`absolute ${tooltipClasses} px-2.5 py-1 bg-slate-900/95 backdrop-blur-md border border-slate-700 text-slate-200 text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50`}
                    >
                      {item.label}
                    </div>

                    {/* Icon Container with macOS style gradient & glow */}
                    <div
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${
                        isActive
                          ? `bg-gradient-to-tr ${item.color} text-white shadow-cyan-500/30 ring-2 ring-cyan-400 scale-105`
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white hover:-translate-y-0.5'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />

                      {/* Badge */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg border border-slate-900 animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Active Indicator Dot */}
                    <span
                      className={`mt-0.5 w-1 h-1 rounded-full transition-all duration-200 ${
                        isActive ? 'bg-cyan-400 w-2.5 shadow-glow' : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
};
