// IndexedDB helper for heavy Base64 photos
// localStorage has 5MB limit — photos need GB-scale storage.

const DB_NAME = 'orca_photos_db';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(base64: string, prefix: string = 'photo'): Promise<string> {
  const key = `idx_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await setPhoto(key, base64);
  return key;
}

export async function setPhoto(key: string, base64: string): Promise<void> {
  // 1. احفظ محلياً
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(base64, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[photoStorage] IndexedDB save failed:', err);
  }

  // 2. ارفع للسيرفر في الخلفية (لا ننتظر)
  void uploadPhotoToServer(key, base64).catch((err) => {
    console.warn('[photoStorage] Server upload failed:', err);
  });
}

async function uploadPhotoToServer(key: string, dataUrl: string): Promise<void> {
  try {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data: dataUrl }),
    });
    if (!res.ok) {
      console.warn('[photoStorage] Upload returned', res.status);
    }
  } catch (err) {
    console.warn('[photoStorage] Upload error:', err);
  }
}

export async function getPhoto(key: string): Promise<string | null> {
  // 1. ابحث في IndexedDB أولاً
  try {
    const db = await openDB();
    const local = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error);
    });

    if (local) return local;
  } catch (err) {
    console.warn('[photoStorage] IndexedDB read failed:', err);
  }

  // 2. اجلب من السيرفر
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(key)}`);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json.success || !json.data) return null;

    // 3. احفظ محلياً للاستخدام التالي
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(json.data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}

    return json.data;
  } catch (err) {
    console.warn('[photoStorage] Server fetch failed:', err);
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listPhotoKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllPhotos(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function migratePhotosToIndexedDB(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // 1. Check migration flag (runs once)
  const MIGRATION_FLAG = 'orca_photos_migration_v1';
  if (window.localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return;
  }

  let totalMigrated = 0;

  try {
    // 2. Scan and migrate parcels (Production & Legacy keys)
    const parcelStorageKeys = [
      'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5_parcels',
      'orca_logistics_v4_parcels',
    ];

    for (const parcelKey of parcelStorageKeys) {
      const rawParcels = window.localStorage.getItem(parcelKey);
      if (!rawParcels) continue;

      try {
        const parcels = JSON.parse(rawParcels);
        if (Array.isArray(parcels)) {
          let modified = false;

          for (const p of parcels) {
            const pId = p.id || p.trackingNumber || Date.now();

            // Sender ID photos
            if (p.sender?.idPhotoFront && typeof p.sender.idPhotoFront === 'string' && p.sender.idPhotoFront.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_sender_id_front`;
              await setPhoto(photoKey, p.sender.idPhotoFront);
              p.sender.idPhotoFront = photoKey;
              totalMigrated++;
              modified = true;
            }
            if (p.sender?.idPhotoBack && typeof p.sender.idPhotoBack === 'string' && p.sender.idPhotoBack.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_sender_id_back`;
              await setPhoto(photoKey, p.sender.idPhotoBack);
              p.sender.idPhotoBack = photoKey;
              totalMigrated++;
              modified = true;
            }

            // Receiver national ID URLs / photo fields
            if (p.receiver?.nationalIdPhotoUrl && typeof p.receiver.nationalIdPhotoUrl === 'string' && p.receiver.nationalIdPhotoUrl.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_front`;
              await setPhoto(photoKey, p.receiver.nationalIdPhotoUrl);
              p.receiver.nationalIdPhotoUrl = photoKey;
              totalMigrated++;
              modified = true;
            }
            if (p.receiver?.nationalIdBackPhotoUrl && typeof p.receiver.nationalIdBackPhotoUrl === 'string' && p.receiver.nationalIdBackPhotoUrl.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_back`;
              await setPhoto(photoKey, p.receiver.nationalIdBackPhotoUrl);
              p.receiver.nationalIdBackPhotoUrl = photoKey;
              totalMigrated++;
              modified = true;
            }
            if (p.receiver?.idPhotoFront && typeof p.receiver.idPhotoFront === 'string' && p.receiver.idPhotoFront.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_front`;
              await setPhoto(photoKey, p.receiver.idPhotoFront);
              p.receiver.idPhotoFront = photoKey;
              totalMigrated++;
              modified = true;
            }
            if (p.receiver?.idPhotoBack && typeof p.receiver.idPhotoBack === 'string' && p.receiver.idPhotoBack.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_back`;
              await setPhoto(photoKey, p.receiver.idPhotoBack);
              p.receiver.idPhotoBack = photoKey;
              totalMigrated++;
              modified = true;
            }

            // Root parcel ID photo fields
            if (p.idPhotoFront && typeof p.idPhotoFront === 'string' && p.idPhotoFront.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_front`;
              await setPhoto(photoKey, p.idPhotoFront);
              p.idPhotoFront = photoKey;
              totalMigrated++;
              modified = true;
            }
            if (p.idPhotoBack && typeof p.idPhotoBack === 'string' && p.idPhotoBack.startsWith('data:image/')) {
              const photoKey = `parcel_${pId}_receiver_id_back`;
              await setPhoto(photoKey, p.idPhotoBack);
              p.idPhotoBack = photoKey;
              totalMigrated++;
              modified = true;
            }
          }

          if (modified) {
            window.localStorage.setItem(parcelKey, JSON.stringify(parcels));
          }
        }
      } catch (err) {
        console.warn(`[Photo Migration] Warning migrating ${parcelKey}:`, err);
      }
    }

    // 3. Scan and migrate customers (Production & Legacy keys)
    const customerStorageKeys = [
      'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5_customers',
      'orca_logistics_v4_customers',
    ];

    for (const custKey of customerStorageKeys) {
      const rawCust = window.localStorage.getItem(custKey);
      if (!rawCust) continue;

      try {
        const customers = JSON.parse(rawCust);
        if (Array.isArray(customers)) {
          let modified = false;

          for (const c of customers) {
            const cId = c.id || c.nationalId || Date.now();

            if (c.idPhotoFront && typeof c.idPhotoFront === 'string' && c.idPhotoFront.startsWith('data:image/')) {
              const photoKey = `customer_${cId}_id_front`;
              await setPhoto(photoKey, c.idPhotoFront);
              c.idPhotoFront = photoKey;
              totalMigrated++;
              modified = true;
            }

            if (c.idPhotoBack && typeof c.idPhotoBack === 'string' && c.idPhotoBack.startsWith('data:image/')) {
              const photoKey = `customer_${cId}_id_back`;
              await setPhoto(photoKey, c.idPhotoBack);
              c.idPhotoBack = photoKey;
              totalMigrated++;
              modified = true;
            }
          }

          if (modified) {
            window.localStorage.setItem(custKey, JSON.stringify(customers));
          }
        }
      } catch (err) {
        console.warn(`[Photo Migration] Warning migrating ${custKey}:`, err);
      }
    }

    // 4. Set flag in localStorage so it only runs once
    window.localStorage.setItem(MIGRATION_FLAG, 'true');

    // 5. Log count in console
    console.log(`[Photo Migration] Completed: ${totalMigrated} photos migrated to IndexedDB.`);
  } catch (err) {
    console.warn('[Photo Migration] Global migration error:', err);
  }
}

export async function migrateBase64ToIndexedDB(
  collection: string,
  items: any[],
  imageFields: string[]
): Promise<any[]> {
  const migrated: any[] = [];
  for (const item of items) {
    let newItem = { ...item };
    for (const field of imageFields) {
      const val = item[field];
      if (val && typeof val === 'string' && val.startsWith('data:image/')) {
        const key = `${collection}_${item.id || item.nationalId || Date.now()}_${field}`;
        await setPhoto(key, val);
        newItem[field] = key;
      }
    }
    migrated.push(newItem);
  }
  return migrated;
}

