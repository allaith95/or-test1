import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDynamicAppIconFromStorage } from './utils/dynamicIconManager';
import { migratePhotosToIndexedDB } from './utils/photoStorage';
import { emergencyLocalStorageCleanup } from './utils/storage';

// 🛑 Migration of legacy storage keys is permanently DISABLED to prevent reviving old mock/test data
(function migrateStorageKeys() {
  console.warn('[Storage] Migration is DISABLED for production safety. Legacy keys will not be merged.');
})();

// ✅ Asynchronous migration of heavy Base64 identity images to IndexedDB
migratePhotosToIndexedDB().catch((err) => {
  console.warn('[Photo Migration] Background migration warning:', err);
});

// ✅ Emergency cleanup: إذا localStorage ممتلئ، نظّفه
try {
  const totalMB = (() => {
    let t = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        t += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    }
    return t / 1024 / 1024;
  })();

  if (totalMB > 4.0) {
    console.warn(`[Emergency Cleanup] localStorage is ${totalMB.toFixed(2)}MB — cleaning...`);
    const result = emergencyLocalStorageCleanup();
    console.log(`[Emergency Cleanup] Freed ${result.freedMB}MB`);
    console.log('[Emergency Cleanup] Removed:', result.removed);
  }
} catch (err) {
  console.warn('[Emergency Cleanup] Error:', err);
}

// ✅ Initialize dynamic favicon
initDynamicAppIconFromStorage();

// ✅ Unregister service workers
(async () => {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
  } catch (error) {
    console.warn('[SW Cleanup] Warning:', error);
  }
})();

// ✅ Disable arrow keys in number inputs
window.addEventListener(
  'keydown',
  (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === 'number') {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
    }
  },
  { capture: true }
);

// ✅ Disable mouse wheel in number inputs
window.addEventListener(
  'wheel',
  (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) {
      e.preventDefault();
    }
  },
  { passive: false }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);