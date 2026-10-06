import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClientSetup';
import { OrcaProvider, useOrca, ActiveModule } from './context/OrcaContext';
import { DesktopSurface } from './components/DesktopSurface';
import { DesktopTaskbar } from './components/DesktopTaskbar';
import { DesktopStartMenu } from './components/DesktopStartMenu';
import { DesktopNotificationsPanel } from './components/DesktopNotificationsPanel';
import { DesktopQuickActionsPanel } from './components/DesktopQuickActionsPanel';
import { DesktopWindowHeader } from './components/DesktopWindowHeader';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { ParcelIntakeView } from './components/ParcelIntakeView';
import { TruckManifestsView } from './components/TruckManifestsView';
import { WarehouseArrivalsView } from './components/WarehouseArrivalsView';
import { DeliveryCouriersView } from './components/DeliveryCouriersView';
import { CashboxView } from './components/CashboxView';
import { PricingEngineView } from './components/PricingEngineView';
import { AdminUsersBranchesView } from './components/AdminUsersBranchesView';
import { BackupCloudView } from './components/BackupCloudView';
import { MasterAdminDashboard } from './components/MasterAdminDashboard';
import { ExpensesDirectoryView } from './components/ExpensesDirectoryView';
import { CustomerDirectoryView } from './components/CustomerDirectoryView';
import { VehicleDirectoryView } from './components/VehicleDirectoryView';
import { EmployeePayrollView } from './components/EmployeePayrollView';
import { FixedAssetsView } from './components/FixedAssetsView';
import { CourierMobilePortal } from './components/CourierMobilePortal';
import { CustomerPortalView } from './components/CustomerPortalView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CustomerPortalLoginScreen } from './components/CustomerPortalLoginScreen';
import { CourierPortalLoginScreen } from './components/CourierPortalLoginScreen';
import { PublicLandingPage } from './components/PublicLandingPage';
import { CustomerPortalShareModal } from './components/CustomerPortalShareModal';
import { WelcomeLoginScreen } from './components/WelcomeLoginScreen';
import { PrintModal } from './components/PrintModal';
import { ParcelStatusModal } from './components/ParcelStatusModal';
import { CashierCollectionModal } from './components/CashierCollectionModal';
import { ShortageResolutionModal } from './components/ShortageResolutionModal';
import { LostParcelSettlementModal } from './components/LostParcelSettlementModal';
import { ParcelRerouteModal } from './components/ParcelRerouteModal';
import { CodSenderPayoutModal } from './components/CodSenderPayoutModal';
import { CodPayoutReceiptModal } from './components/CodPayoutReceiptModal';
import { CourierIntakeSettlementPrintModal } from './components/CourierIntakeSettlementPrintModal';
import { QuickSearchSpotlightModal } from './components/QuickSearchSpotlightModal';
import { AdminDirectivesModal } from './components/AdminDirectivesModal';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { CloudConnectionAlert } from './components/CloudConnectionAlert';
import { SyncAuditFullScreen } from './components/SyncAuditFullScreen';
import { BootstrapSetupModal } from './components/BootstrapSetupModal';
import { CreateFirstBranchModal } from './components/CreateFirstBranchModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DynamicAmbientBackdrop } from './components/DynamicAmbientBackdrop';
import { safeStorage } from './utils/storage';
import { AnimatePresence, motion } from 'motion/react';

// Memoized module view renderer to avoid re-rendering heavy views on taskbar/popup state changes
const ActiveModuleRenderer: React.FC<{ activeModule: ActiveModule }> = React.memo(({ activeModule }) => {
  switch (activeModule) {
    case 'dashboard':
      return <DashboardAnalytics />;
    case 'intake':
      return <ParcelIntakeView />;
    case 'manifests':
      return <TruckManifestsView />;
    case 'arrivals':
      return <WarehouseArrivalsView />;
    case 'delivery':
      return <DeliveryCouriersView />;
    case 'cashbox':
      return <CashboxView />;
    case 'pricing':
      return <PricingEngineView />;
    case 'admin_users':
      return <AdminUsersBranchesView />;
    case 'backup_cloud':
      return <BackupCloudView />;
    case 'master_admin':
      return <MasterAdminDashboard />;
    case 'expenses':
      return <ExpensesDirectoryView />;
    case 'customers':
      return <CustomerDirectoryView />;
    case 'vehicles':
      return <VehicleDirectoryView />;
    case 'payroll':
      return <EmployeePayrollView />;
    case 'fixed_assets':
      return <FixedAssetsView />;
    case 'courier_portal':
      return <CourierMobilePortal />;
    case 'customer_portal':
      return <CustomerPortalView />;
    default:
      return <DashboardAnalytics />;
  }
});

const MainAppContent: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    isAuthenticated,
    isWelcomeLoginOpen,
    setIsWelcomeLoginOpen,
    canAccessModule,
    currentUser,
    currentCustomer,
    isCustomerAuthenticated,
    parcels,
    branches,
    currentBranch,
    brandingSettings,
    selectedCourierIntakeVoucherForPrint,
    closeCourierIntakeVoucherPrint,
    codPayoutReceiptParcel,
    closeCodPayoutReceipt,
    formatCurrency,
  } = useOrca();

  // Route Suffix Constants
  // CST-SC: واجهة الزبون
  // CUR-SC: واجهة الموزعين
  // ORCA-AD-LOGIN: واجهة دخول الموظفين والإدارة
  const CUSTOMER_PORTAL_SUFFIX = 'CST-SC';
  const COURIER_PORTAL_SUFFIX = 'CUR-SC';
  const STAFF_LOGIN_SUFFIX = 'ORCA-AD-LOGIN';

  const matchesPortalSuffix = (suffix: string): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      const path = window.location.pathname.toUpperCase();
      const search = window.location.search.toUpperCase();
      const hash = window.location.hash.toUpperCase();
      const upper = suffix.toUpperCase();

      if (path.includes(`/${upper}`) || path.endsWith(upper)) {
        return true;
      }

      const params = new URLSearchParams(window.location.search);
      if (
        params.get('portal')?.toUpperCase() === upper ||
        params.get('view')?.toUpperCase() === upper ||
        params.get('role')?.toUpperCase() === upper ||
        params.get('login')?.toUpperCase() === upper ||
        params.get('admin')?.toUpperCase() === upper ||
        params.get('console')?.toUpperCase() === upper ||
        params.has(upper) ||
        params.has(suffix) ||
        search.includes(upper)
      ) {
        return true;
      }

      if (hash.includes(upper)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  // Mode: Standalone Customer Portal Isolation (لاحقة CST-SC)
  const [isCustomerPortalMode, setIsCustomerPortalMode] = useState<boolean>(() => {
    try {
      const isSuffixMatch = matchesPortalSuffix(CUSTOMER_PORTAL_SUFFIX);
      const params = new URLSearchParams(window.location.search);
      const isLegacyParam =
        params.get('portal') === 'customer' ||
        params.get('view') === 'portal' ||
        params.get('view') === 'customer' ||
        window.location.hash === '#customer';
      return isSuffixMatch || isLegacyParam || (safeStorage.getItem('orca_isolated_portal_active') === 'true');
    } catch {
      return false;
    }
  });

  // Mode: Standalone Courier / Distributor Portal Isolation (لاحقة CUR-SC)
  const [isCourierPortalMode, setIsCourierPortalMode] = useState<boolean>(() => {
    try {
      const isSuffixMatch = matchesPortalSuffix(COURIER_PORTAL_SUFFIX);
      const params = new URLSearchParams(window.location.search);
      const isLegacyParam =
        params.get('portal') === 'courier' ||
        params.get('view') === 'courier' ||
        params.get('courier') === '1' ||
        params.get('role') === 'courier' ||
        window.location.hash === '#courier';
      return isSuffixMatch || isLegacyParam || (safeStorage.getItem('orca_isolated_courier_active') === 'true');
    } catch {
      return false;
    }
  });

  // Mode: Staff & Admin Login Isolation (لاحقة ORCA-AD-LOGIN)
  const [isStaffLoginMode, setIsStaffLoginMode] = useState<boolean>(() => {
    return matchesPortalSuffix(STAFF_LOGIN_SUFFIX);
  });

  // Mode: Bootstrap Setup State & Modal Trigger
  const [bootstrapState, setBootstrapState] = useState<'checking' | 'needed' | 'ready'>('checking');
  const [isBootstrapOpen, setIsBootstrapOpen] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      return path.includes('bootstrap') || params.has('bootstrap') || params.has('key');
    } catch {
      return false;
    }
  });

  // Automatically show clean bootstrap setup if database is empty (0 users)
  useEffect(() => {
    let cancelled = false;

    async function checkBootstrapStatus() {
      try {
        const res = await fetch('/api/bootstrap/status');
        const data = await res.json();

        if (cancelled) return;

        if (data && (!data.isBootstrapped || data.isDbEmpty)) {
          console.warn('[Bootstrap] Server DB empty → purging local cache and IndexedDB');

          // ⚠️ DB is empty -> clear all orca_ keys from localStorage
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              Object.keys(localStorage).forEach((key) => {
                if (key.toLowerCase().startsWith('orca_') || key.toLowerCase().startsWith('orca')) {
                  localStorage.removeItem(key);
                }
              });
            }

            // Delete IndexedDB databases
            if (typeof window !== 'undefined' && 'indexedDB' in window && indexedDB.databases) {
              const dbs = await indexedDB.databases();
              for (const db of dbs) {
                if (db.name && db.name.toLowerCase().includes('orca')) {
                  indexedDB.deleteDatabase(db.name);
                }
              }
            }
          } catch (cleanErr) {
            console.warn('[Bootstrap] Cache clean error:', cleanErr);
          }

          setIsBootstrapOpen(true);
          setBootstrapState('needed');
        } else {
          setBootstrapState('ready');
        }
      } catch (err) {
        console.error('[Bootstrap] Check failed:', err);
        // Fallback: show Bootstrap if API fails
        if (!cancelled) {
          setIsBootstrapOpen(true);
          setBootstrapState('needed');
        }
      }
    }

    checkBootstrapStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  // Desktop OS State (Persisted across refreshes so F5 stays on current view)
  const [isDesktopVisible, setIsDesktopVisible] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get('view') || params.get('mod') || window.location.hash.replace('#', '');
        if (urlView && urlView !== 'desktop') {
          return false;
        }
      }

      const savedDesktopState = safeStorage.getItem('orca_session_is_desktop_visible');
      if (savedDesktopState !== null) {
        return savedDesktopState === 'true';
      }
    } catch {}
    // If user has an active module restored, stay on it rather than resetting to desktop
    return false;
  });

  // Save desktop visibility state to storage
  useEffect(() => {
    safeStorage.setItem('orca_session_is_desktop_visible', String(isDesktopVisible));
  }, [isDesktopVisible]);

  // Warn user before closing or refreshing if there are unsynced pending operations
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const pendingCount = (window as any).__orcaSyncEngine?.state?.pendingQueueCount || 0;
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = `⚠️ يوجد ${pendingCount} عملية لم تُزامَن بعد مع السيرفر. هل أنت متأكد من مغادرة أو تحديث الصفحة؟`;
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Sync activeModule to URL query params
  useEffect(() => {
    if (activeModule && !isDesktopVisible) {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get('view') !== activeModule) {
          u.searchParams.set('view', activeModule);
          window.history.replaceState({}, '', u.toString());
        }
      } catch {}
    } else if (isDesktopVisible) {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has('view')) {
          u.searchParams.delete('view');
          window.history.replaceState({}, '', u.pathname + u.search);
        }
      } catch {}
    }
  }, [activeModule, isDesktopVisible]);

  // Auto Fullscreen / Maximize on App Launch & First User Interaction (PWA & Desktop App)
  useEffect(() => {
    const tryEnterFullscreen = () => {
      if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    // Attempt immediately on mount
    tryEnterFullscreen();

    // Trigger on first click, tap, or keypress to comply with browser gesture requirements
    const handleUserInteraction = () => {
      tryEnterFullscreen();
    };

    window.addEventListener('click', handleUserInteraction, { capture: true, once: true });
    window.addEventListener('keydown', handleUserInteraction, { capture: true, once: true });
    window.addEventListener('touchstart', handleUserInteraction, { capture: true, once: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleUserInteraction, { capture: true });
      window.removeEventListener('touchstart', handleUserInteraction, { capture: true });
    };
  }, []);

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isDirectivesModalOpen, setIsDirectivesModalOpen] = useState(false);
  const [isCustomerShareModalOpen, setIsCustomerShareModalOpen] = useState(false);
  const [isIntegrityHubOpen, setIsIntegrityHubOpen] = useState(false);

  // Synchronize URL parameters with customer portal, courier portal, and staff login modes
  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const isCustomer =
          matchesPortalSuffix(CUSTOMER_PORTAL_SUFFIX) ||
          new URLSearchParams(window.location.search).get('portal') === 'customer' ||
          window.location.hash === '#customer';
        setIsCustomerPortalMode(
          isCustomer || safeStorage.getItem('orca_isolated_portal_active') === 'true'
        );

        const isCourier =
          matchesPortalSuffix(COURIER_PORTAL_SUFFIX) ||
          new URLSearchParams(window.location.search).get('portal') === 'courier' ||
          window.location.hash === '#courier';
        setIsCourierPortalMode(
          isCourier || safeStorage.getItem('orca_isolated_courier_active') === 'true'
        );

        setIsStaffLoginMode(matchesPortalSuffix(STAFF_LOGIN_SUFFIX));
      } catch {
        // ignore
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleEnterCustomerPortalMode = () => {
    setIsCustomerPortalMode(true);
    try {
      safeStorage.setItem('orca_isolated_portal_active', 'true');
      const u = new URL(window.location.href);
      u.searchParams.set('portal', CUSTOMER_PORTAL_SUFFIX);
      window.history.replaceState({}, '', u.toString());
    } catch {
      // ignore
    }
  };

  const handleEnterCourierPortalMode = () => {
    setIsCourierPortalMode(true);
    try {
      safeStorage.setItem('orca_isolated_courier_active', 'true');
      const u = new URL(window.location.href);
      u.searchParams.set('portal', COURIER_PORTAL_SUFFIX);
      window.history.replaceState({}, '', u.toString());
    } catch {
      // ignore
    }
  };

  const handleExitCustomerPortalMode = () => {
    setIsCustomerPortalMode(false);
    try {
      safeStorage.removeItem('orca_isolated_portal_active');
      const u = new URL(window.location.href);
      u.searchParams.delete('portal');
      u.searchParams.delete('view');
      window.history.replaceState({}, '', u.pathname);
    } catch {
      // ignore
    }
  };

  const handleExitCourierPortalMode = () => {
    setIsCourierPortalMode(false);
    try {
      safeStorage.removeItem('orca_isolated_courier_active');
      const u = new URL(window.location.href);
      u.searchParams.delete('portal');
      u.searchParams.delete('view');
      window.history.replaceState({}, '', u.pathname);
    } catch {
      // ignore
    }
  };

  // Audio mute state (persisted)
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return safeStorage.getItem('orca_sound_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Module navigation history for Back button
  const [moduleHistory, setModuleHistory] = useState<ActiveModule[]>([]);

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        safeStorage.setItem('orca_sound_muted', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard Shortcuts (Ctrl+K for search, Escape to dismiss popups)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsStartMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsQuickActionsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-redirect Courier users directly to Courier Mobile Portal
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'courier') {
      if (activeModule !== 'courier_portal') {
        setActiveModule('courier_portal');
      }
      setIsDesktopVisible(false);
    }
  }, [isAuthenticated, currentUser?.role, activeModule, setActiveModule]);

  // =========================================================================
  // 0. BOOTSTRAP CHECK & INITIALIZATION GUARD (فحص التجهيز الأولي وقاعدة البيانات)
  // =========================================================================
  if (bootstrapState === 'checking') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center font-['Cairo',sans-serif] z-[999999]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-bold">جاري فحص حالة النظام وقاعدة البيانات...</p>
        </div>
      </div>
    );
  }

  if (bootstrapState === 'needed' || isBootstrapOpen) {
    return (
      <BootstrapSetupModal
        isOpen={true}
        onSuccess={() => {
          setBootstrapState('ready');
          setIsBootstrapOpen(false);
          window.location.reload();
        }}
        onClose={() => {
          if (bootstrapState === 'ready') {
            setIsBootstrapOpen(false);
          }
        }}
      />
    );
  }

  // =========================================================================
  // 1. ISOLATED COURIER / DISTRIBUTOR PORTAL WORKSPACE (عزل تام لبوابة الموزعين)
  // =========================================================================
  if (isCourierPortalMode) {
    if (isAuthenticated) {
      return (
        <div id="courier_portal_app_root" className="min-h-screen bg-black text-white font-['Cairo',sans-serif]">
          <CourierMobilePortal />
          <PrintModal />
        </div>
      );
    }

    return <CourierPortalLoginScreen />;
  }

  // =========================================================================
  // 2. ISOLATED CUSTOMER PORTAL WORKSPACE (عزل تام لبوابة الزبائن)
  // =========================================================================
  if (isCustomerPortalMode) {
    if (isCustomerAuthenticated && currentCustomer) {
      return (
        <div id="customer_portal_app_root" className="min-h-screen bg-black text-white font-['Cairo',sans-serif]">
          <CustomerPortalView />
          <PrintModal />
        </div>
      );
    }

    return <CustomerPortalLoginScreen />;
  }

  // If customer is authenticated (even without URL param), render customer portal directly
  if (isCustomerAuthenticated && currentCustomer) {
    return (
      <div id="customer_portal_app_root" className="min-h-screen bg-slate-900 text-slate-100 font-['Cairo',sans-serif]">
        <CustomerPortalView />
        <PrintModal />
      </div>
    );
  }

  // =========================================================================
  // 3. STAFF & ADMIN LOGIN (بوابة دخول موظفي الشركة والإدارة باللاحقة المعتمدة ORCA-AD-LOGIN)
  // =========================================================================
  if (isStaffLoginMode && !isAuthenticated) {
    return <WelcomeLoginScreen />;
  }

  // =========================================================================
  // 4. PUBLIC LANDING & SHIPMENT TRACKING PAGE FOR GENERAL VISITORS
  // (العنوان الأساسي بدون لاحقة للواجهة العامة حصراً - معزولة تماماً بدون أي ربط أو أزرار)
  // =========================================================================
  if (!isAuthenticated) {
    return <PublicLandingPage />;
  }

  // Guard: If Super Admin is logged in but 0 branches exist, force creation of First Branch & Staff
  if (isAuthenticated && currentUser?.role === 'super_admin' && (branches.length === 0 || !currentBranch)) {
    return (
      <CreateFirstBranchModal
        isOpen={true}
        onSuccess={() => window.location.reload()}
      />
    );
  }

  // Pure Standalone Mobile Experience for Couriers (No desktop OS, no taskbar, no window headers)
  if (currentUser?.role === 'courier') {
    return (
      <div className="min-h-screen h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-['Cairo',sans-serif] select-none">
        <CourierMobilePortal />
        {isWelcomeLoginOpen && (
          <WelcomeLoginScreen isModal onClose={() => setIsWelcomeLoginOpen(false)} />
        )}
      </div>
    );
  }

  // Action: Launch or switch to module
  const handleOpenModule = (mod: ActiveModule) => {
    if (!isDesktopVisible && activeModule && activeModule !== mod) {
      setModuleHistory((prev) => [...prev, activeModule]);
    }
    setActiveModule(mod);
    setIsDesktopVisible(false);
    setIsStartMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsQuickActionsOpen(false);
  };

  // Action: Taskbar App Click (toggles minimize or switches module)
  const handleTaskbarSelectModule = (mod: ActiveModule) => {
    if (activeModule === mod) {
      // Toggle between minimized to desktop and restored
      setIsDesktopVisible((prev) => !prev);
    } else {
      if (!isDesktopVisible && activeModule) {
        setModuleHistory((prev) => [...prev, activeModule]);
      }
      setActiveModule(mod);
      setIsDesktopVisible(false);
    }
    setIsStartMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsQuickActionsOpen(false);
  };

  // Action: Back button handler (navigates to previous module or to desktop)
  const handleBack = () => {
    if (moduleHistory.length > 0) {
      const prev = moduleHistory[moduleHistory.length - 1];
      setModuleHistory((hist) => hist.slice(0, -1));
      setActiveModule(prev);
      setIsDesktopVisible(false);
    } else {
      setIsDesktopVisible(true);
    }
  };

  // Action: Toggle Show Desktop
  const handleToggleShowDesktop = () => {
    setIsDesktopVisible((prev) => !prev);
    setIsStartMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsQuickActionsOpen(false);
  };

  return (
    <div
      id="orca_fluent_os_root"
      className="min-h-screen h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-['Cairo',sans-serif] select-none"
    >
      {/* Dynamic Animated Ambient Backdrop (خلفية ضوئية تفاعلية عميقة وخفيفة) */}
      <DynamicAmbientBackdrop
        activeModule={activeModule}
        isDesktopVisible={isDesktopVisible}
      />

      {/* ========================================================================= */}
      {/* DESKTOP WORKSPACE AREA (above taskbar) */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden relative">
        <AnimatePresence>
          {isDesktopVisible ? (
            /* 1. INTERACTIVE DESKTOP SURFACE */
            <motion.div
              key="fluent_desktop_surface_view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="w-full h-full overflow-y-auto custom-scrollbar transform-gpu"
            >
              <DesktopSurface
                onOpenModule={handleOpenModule}
                onOpenSearch={() => setIsSpotlightOpen(true)}
                onOpenDirectives={() => setIsDirectivesModalOpen(true)}
              />
            </motion.div>
          ) : (
            /* 2. ACTIVE WINDOW VIEW WITH WINDOW HEADER (FULLSCREEN) */
            <motion.div
              key={`window_${activeModule}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="w-full h-full flex flex-col p-0 transform-gpu"
            >
              <div
                id="fluent_window_frame"
                className="w-full h-full flex flex-col bg-slate-900/95 backdrop-blur-xl border-0 shadow-none overflow-hidden rounded-none"
              >
                {/* Standardized Compact Window Header with Back button */}
                <DesktopWindowHeader
                  onBack={handleBack}
                  onClose={() => setIsDesktopVisible(true)}
                  onOpenSearch={() => setIsSpotlightOpen(true)}
                />

                {/* Window Body Container */}
                <div
                  className={`flex-1 w-full overflow-y-auto custom-scrollbar bg-slate-950/70 ${
                    activeModule === 'dashboard'
                      ? 'p-0'
                      : activeModule === 'pricing'
                      ? 'p-1.5 sm:p-2.5 lg:p-3.5'
                      : activeModule === 'expenses'
                      ? 'p-2 sm:p-4 lg:p-6'
                      : 'p-2 sm:p-3 lg:p-4'
                  }`}
                >
                  {!canAccessModule(activeModule) ? (
                    <AccessDeniedScreen
                      attemptedModule={activeModule}
                      onGoToDesktop={() => setIsDesktopVisible(true)}
                    />
                  ) : (
                    <ActiveModuleRenderer activeModule={activeModule} />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP TASKBAR (شريط المهام السفلي المتطور) */}
      {/* ========================================================================= */}
      <DesktopTaskbar
        isDesktopVisible={isDesktopVisible}
        onToggleShowDesktop={handleToggleShowDesktop}
        onToggleStartMenu={() => {
          setIsStartMenuOpen((prev) => !prev);
          setIsNotificationsOpen(false);
          setIsQuickActionsOpen(false);
        }}
        isStartMenuOpen={isStartMenuOpen}
        onOpenSearch={() => setIsSpotlightOpen(true)}
        onToggleNotifications={() => {
          setIsNotificationsOpen((prev) => !prev);
          setIsQuickActionsOpen(false);
          setIsStartMenuOpen(false);
        }}
        isNotificationsOpen={isNotificationsOpen}
        onToggleQuickActions={() => {
          setIsQuickActionsOpen((prev) => !prev);
          setIsNotificationsOpen(false);
          setIsStartMenuOpen(false);
        }}
        isQuickActionsOpen={isQuickActionsOpen}
        onOpenDirectives={() => setIsDirectivesModalOpen(true)}
        onOpenIntegrityHub={() => {
          if (currentUser?.role === 'super_admin') {
            setIsIntegrityHubOpen(true);
          } else {
            console.warn('[Security] Non-admin attempted to open Integrity Hub');
          }
        }}
        onSelectModule={handleTaskbarSelectModule}
      />

      {/* ========================================================================= */}
      {/* START MENU POPUP (قائمة البدء) */}
      {/* ========================================================================= */}
      <DesktopStartMenu
        isOpen={isStartMenuOpen}
        onClose={() => setIsStartMenuOpen(false)}
        onOpenModule={handleOpenModule}
        onOpenDirectivesModal={() => {
          setIsStartMenuOpen(false);
          setIsDirectivesModalOpen(true);
        }}
        onOpenSwitchUser={() => setIsWelcomeLoginOpen(true)}
        onOpenIntegrityHub={() => {
          setIsStartMenuOpen(false);
          if (currentUser?.role === 'super_admin') {
            setIsIntegrityHubOpen(true);
          } else {
            console.warn('[Security] Non-admin attempted to open Integrity Hub');
          }
        }}
      />

      {/* ========================================================================= */}
      {/* NOTIFICATIONS PANEL (مركز الإشعارات والتنبيهات المستقل) */}
      {/* ========================================================================= */}
      <DesktopNotificationsPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* ========================================================================= */}
      {/* QUICK ACTIONS PANEL (لوحة الإختصارات السريعة المستقلة) */}
      {/* ========================================================================= */}
      <DesktopQuickActionsPanel
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenCashbox={() => handleOpenModule('cashbox')}
        onOpenStagnantInspector={() => handleOpenModule('arrivals')}
        onOpenDirectives={() => setIsDirectivesModalOpen(true)}
        onOpenSearch={() => setIsSpotlightOpen(true)}
        onSelectModule={handleOpenModule}
      />

      {/* ========================================================================= */}
      {/* GLOBAL SEARCH & SPOTLIGHT MODAL (Ctrl+K) */}
      {/* ========================================================================= */}
      {isSpotlightOpen && (
        <QuickSearchSpotlightModal
          isOpen={isSpotlightOpen}
          onClose={() => setIsSpotlightOpen(false)}
          onNavigate={(targetModule) => {
            setIsSpotlightOpen(false);
            handleOpenModule(targetModule);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* ADMINISTRATIVE DIRECTIVES & MEMOS MODAL */}
      {/* ========================================================================= */}
      {isDirectivesModalOpen && (
        <AdminDirectivesModal
          isOpen={isDirectivesModalOpen}
          onClose={() => setIsDirectivesModalOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* CLOUD CONNECTION VISUAL ALERT (تنبيه انقطاع الاتصال بالسحابة) */}
      {/* ========================================================================= */}
      <CloudConnectionAlert />

      {/* ========================================================================= */}
      {/* SYSTEM PRINT & AUDIT MODALS */}
      {/* ========================================================================= */}
      <PrintModal />
      <ParcelStatusModal />
      <CashierCollectionModal />
      <ShortageResolutionModal />
      <LostParcelSettlementModal />
      <ParcelRerouteModal />
      <CodSenderPayoutModal />
      <CodPayoutReceiptModal
        isOpen={!!codPayoutReceiptParcel}
        onClose={closeCodPayoutReceipt}
        parcel={codPayoutReceiptParcel}
        branch={currentBranch}
        formatCurrency={formatCurrency}
      />
      {selectedCourierIntakeVoucherForPrint && (
        <CourierIntakeSettlementPrintModal
          voucher={selectedCourierIntakeVoucherForPrint}
          parcels={parcels}
          branch={currentBranch}
          brandingSettings={brandingSettings}
          onClose={closeCourierIntakeVoucherPrint}
        />
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER PORTAL SHARE MODAL */}
      {/* ========================================================================= */}
      <CustomerPortalShareModal
        isOpen={isCustomerShareModalOpen}
        onClose={() => setIsCustomerShareModalOpen(false)}
        onPreviewPortal={handleEnterCustomerPortalMode}
      />

      {/* ========================================================================= */}
      {/* BOOTSTRAP FIRST-TIME SETUP MODAL */}
      {/* ========================================================================= */}
      <BootstrapSetupModal
        isOpen={isBootstrapOpen}
        onClose={() => setIsBootstrapOpen(false)}
      />

      {/* ========================================================================= */}
      {/* USER SWITCH / WELCOME MODAL */}
      {/* ========================================================================= */}
      {isWelcomeLoginOpen && (
        <WelcomeLoginScreen
          isModal
          onClose={() => setIsWelcomeLoginOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* SYNC & PARCEL INTEGRITY HUB FULL-SCREEN WORKSTATION */}
      {/* ========================================================================= */}
      <SyncAuditFullScreen
        isOpen={isIntegrityHubOpen}
        onClose={() => setIsIntegrityHubOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallbackTitle="منظومة أوركا إكسبريس">
        <OrcaProvider>
          <ErrorBoundary fallbackTitle="واجهة سطح مكتب أوركا">
            <MainAppContent />
          </ErrorBoundary>
        </OrcaProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
