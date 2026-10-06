import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  initPostgres,
  getPostgresStatus,
  pullAllFromPostgres,
  pullChangesSince,
  type SyncWatermark,
  saveItemToPostgres,
  batchSaveToPostgres,
  pushAllToPostgres,
  generateSqlDump,
  isPostgresActive,
  getFinancialAuditLogs,
  clearPostgresOperationalData,
  backfillObligationsOnce,
  migrateParcelEventsOnce,
  applySchemaV2,
  migrateCollectionsToAppTables,
  mergeParcelSafely,
  mergeCustomerSafely,
  mergeUserSafely,
  mergeBranchSafely,
  queryWithRetry,
} from './server/postgres.ts';

const app = express();
const PORT = 3000;

// Trust reverse proxy (Nginx / Cloud Run / Caddy)
app.set('trust proxy', 1);

// ==========================================
// 1. Enterprise Security Headers & HTTPS Enforcement
// ==========================================
app.use((req: Request, res: Response, next) => {
  // 1.1 Force HTTPS Redirect in production environments when behind a reverse proxy
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] === 'http'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  // 1.2 Strict-Transport-Security (HSTS) - only sent on HTTPS
  if (req.headers['x-forwarded-proto'] === 'https' || req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 1.3 MIME Sniffing, XSS & Clickjacking Defenses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; manifest-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:; media-src 'self' data: blob:; worker-src 'self' blob:;"
  );

  // 1.4 Permissions Policy: explicitly permit camera for QR/barcode and ID document scanning
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');

  next();
});

// ==========================================
// 2. Input Sanitization & Anti-Injection Middleware
// ==========================================
// Recursively sanitizes strings against XSS, null-byte poisoning, and prototype pollution
function sanitizeData<T>(input: T): T {
  if (typeof input === 'string') {
    let clean = input.replace(/\0/g, ''); // strip null bytes
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/javascript\s*:/gi, '');
    clean = clean.replace(/vbscript\s*:/gi, '');
    return clean as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeData) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      // Disallow Prototype Pollution keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      cleanObj[key] = sanitizeData((input as any)[key]);
    }
    return cleanObj as unknown as T;
  }
  return input;
}

// Enable JSON body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply recursive sanitizer on all API requests
app.use('/api', (req: Request, res: Response, next) => {
  // Strict Zero-Browser-Cache: Ensure live server is the single source of truth
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeData(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeData(req.query);
  }
  next();
});

// ==========================================
// 3. Rate Limiter & Anti-Flooding Protection for API
// ==========================================
const ipRequestWindow = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 400; // 400 requests/min per IP (ample for real-time logistics sync)

app.use('/api', (req: Request, res: Response, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const now = Date.now();
  const record = ipRequestWindow.get(clientIp);

  if (!record || now > record.resetAt) {
    ipRequestWindow.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً بعد دقيقة.',
    });
  }

  next();
});

// Allowed Collections Whitelist
const ALLOWED_COLLECTIONS = new Set([
  'users',
  'branches',
  'parcels',
  'truckManifests',
  'courierManifests',
  'transactions',
  'settlements',
  'shiftSettlements',
  'shiftSettlementVouchers',
  'financialVouchers',
  'vouchers',
  'customers',
  'vehicles',
  'employees',
  'payrollRecords',
  'expenses',
  'expenseCategories',
  'fixedAssets',
  'directMessages',
  'notifications',
  'pricingRules',
  'auditLogs',
  'brandingSettings',
  'codSettings',
  'alertsSettings',
  'courierIntakeSettlements',
  'interBranchObligations',
  'parcelEvents',
]);

const CRITICAL_COLLECTIONS = new Set([
  'parcels',
  'customers',
  'users',
  'branches',
  'transactions',
  'vouchers',
  'interBranchObligations',
  'parcelEvents',
  'truckManifests',
  'courierManifests',
  'shiftSettlementVouchers',
  'courierIntakeSettlements',
  'financialVouchers',
  'settlements',
]);

// Data storage directory on VPS / Container fallback
const DATA_DIR = path.join(process.cwd(), 'vps-data');
const DB_FILE = path.join(DATA_DIR, 'orca-database.json');
const LOGS_FILE = path.join(DATA_DIR, 'audit-sync.log');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-memory cache for ultra-fast response
let memoryDatabase: Record<string, any> = {};

// 🛑 Legacy file loading is disabled. Enabled ONLY if explicitly commanded by environment flag.
function loadDatabaseFromFile() {
  if (process.env.ALLOW_LEGACY_FILE === 'true') {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        memoryDatabase = JSON.parse(content) || {};
        console.log(`[VPS Server] Legacy file loaded because ALLOW_LEGACY_FILE=true: ${DB_FILE}`);
      }
    } catch (err) {
      console.warn('[VPS Server] Error reading legacy file:', err);
    }
  }
}

// Save database to disk atomically as emergency persistence
function persistDatabaseToFile() {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(memoryDatabase, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryDatabase, null, 2), 'utf-8');
    } catch (e2) {
      console.error('[VPS Server] Error writing DB file:', e2);
    }
  }
}

// In-memory cache for PostgreSQL reads (prevents database connection pool exhaustion and router bufferbloat)
let lastPgPullTimestampMs = 0;
let lastSyncWatermark: SyncWatermark | null = null;
let lastFullResyncMs = 0;
let isRefreshing = false;
const PG_CACHE_TTL_MS = 2500; // 2.5 seconds cache TTL
const FULL_RESYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes periodic full resync to purge deleted items

async function refreshMemoryDatabaseFromPostgres(force = false): Promise<void> {
  if (!isPostgresActive()) return;

  const now = Date.now();
  if (!force && now - lastPgPullTimestampMs <= PG_CACHE_TTL_MS) {
    return;
  }

  // Prevent overlapping concurrent sync cycles (Race Condition Protection)
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const needsFullResync =
      !lastSyncWatermark ||
      force ||
      now - lastFullResyncMs > FULL_RESYNC_INTERVAL_MS;

    if (needsFullResync) {
      // مزامنة كاملة — تستبدل الذاكرة بالكامل وتحذف العناصر المحذوفة وتستخرج watermark حقيقي من DB
      const fullDelta = await pullChangesSince({ updatedAt: '1970-01-01T00:00:00.000000Z', id: '' });
      if (!fullDelta) return;

      const SYNCED_COLLECTIONS = [
        'parcels','truckManifests','courierManifests','transactions','settlements',
        'shiftSettlementVouchers','courierIntakeSettlements','vouchers','customers',
        'vehicles','employees','payrollRecords','expenses','expenseCategories',
        'fixedAssets','branches','users','directMessages','notifications','pricingRules',
        'interBranchObligations','parcelEvents'
      ];

      for (const col of SYNCED_COLLECTIONS) {
        memoryDatabase[col] = fullDelta.data[col] || [];
      }

      lastFullResyncMs = now;
      lastPgPullTimestampMs = now;
      lastSyncWatermark = fullDelta.watermark || { updatedAt: '1970-01-01T00:00:00.000000Z', id: '' };
      console.log('[Sync] Full resync completed (deletions applied, watermark aligned to DB clock).');
      return;
    }

    // المزامنة التفاضلية اللاحقة بدقة التايم-ستامب والمعرف (Watermark Tuple)
    const deltaResult = await pullChangesSince(lastSyncWatermark);
    if (!deltaResult) return;

    const delta = deltaResult.data;

    for (const col of Object.keys(delta)) {
      if (!Array.isArray(memoryDatabase[col])) {
        memoryDatabase[col] = delta[col];
      } else {
        const itemMap = new Map<string, any>();
        for (const item of memoryDatabase[col]) {
          const idKey = item.id || item.trackingNumber || item.manifestNumber || item.code || item.voucherNumber || item.username;
          if (idKey) itemMap.set(String(idKey), item);
        }
        for (const item of delta[col]) {
          const idKey = item.id || item.trackingNumber || item.manifestNumber || item.code || item.voucherNumber || item.username;
          if (idKey) {
            const existing = itemMap.get(String(idKey));
            if (existing && col === 'parcels') {
              itemMap.set(String(idKey), mergeParcelSafely(existing, item));
            } else if (existing && col === 'customers') {
              itemMap.set(String(idKey), mergeCustomerSafely(existing, item));
            } else if (existing && col === 'users') {
              itemMap.set(String(idKey), mergeUserSafely(existing, item));
            } else if (existing && col === 'branches') {
              itemMap.set(String(idKey), mergeBranchSafely(existing, item));
            } else if (existing) {
              itemMap.set(String(idKey), { ...existing, ...item });
            } else {
              itemMap.set(String(idKey), item);
            }
          } else {
            memoryDatabase[col].push(item);
          }
        }
        memoryDatabase[col] = Array.from(itemMap.values());
      }
    }

    lastPgPullTimestampMs = now;
    // تحديث الـ watermark فقط بعد تطبيق كافة التغييرات بنجاح في الذاكرة
    if (deltaResult.watermark) {
      lastSyncWatermark = deltaResult.watermark;
    }
  } catch (err) {
    console.error('[Sync] refreshMemoryDatabaseFromPostgres failed:', err);
  } finally {
    isRefreshing = false;
  }
}

function invalidatePostgresCache(): void {
  lastPgPullTimestampMs = 0;
}

// ==========================================
// VPS REST API Routes
// ==========================================

// 0. Ultra-lightweight Ping Endpoint for instant RTT measurement & connection health check
app.get(['/api/ping', '/api/vps/ping'], (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'Orca Express Server',
    timestamp: Date.now(),
    iso: new Date().toISOString(),
  });
});

// 1. Health & Server Info Ping (Includes PostgreSQL status)
app.get('/api/health', async (req: Request, res: Response) => {
  const pgStatus = await getPostgresStatus();

  res.json({
    status: isPostgresActive() ? 'ok' : 'degraded',
    service: 'Orca Express Logistics VPS Server',
    version: '5.1.0-PostgreSQL-Strict',
    databaseStatus: isPostgresActive() ? 'postgres_connected' : 'postgres_disconnected',
    postgres: {
      connected: isPostgresActive(),
      pingMs: pgStatus.pingMs,
      error: pgStatus.error,
      configSource: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.PGHOST ? 'PGHOST' : 'none',
    },
    criticalWritesEnabled: isPostgresActive(),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    recordsSummary: {
      branches: Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0,
      parcels: Array.isArray(memoryDatabase.parcels) ? memoryDatabase.parcels.length : 0,
      truckManifests: Array.isArray(memoryDatabase.truckManifests) ? memoryDatabase.truckManifests.length : 0,
      users: Array.isArray(memoryDatabase.users) ? memoryDatabase.users.length : 0,
      courierManifests: Array.isArray(memoryDatabase.courierManifests) ? memoryDatabase.courierManifests.length : 0,
      transactions: Array.isArray(memoryDatabase.cashboxTransactions) ? memoryDatabase.cashboxTransactions.length : 0,
    },
  });
});

// 2. Dedicated PostgreSQL Database Status
app.get('/api/db/status', async (req: Request, res: Response) => {
  const status = await getPostgresStatus();
  const totalEntities = status.counts ? Object.values(status.counts).reduce((a, b) => a + b, 0) : 0;
  const isDbEmpty = totalEntities === 0;

  res.json({
    success: true,
    postgres: status,
    isDbEmpty,
    totalEntities,
    legacyFileStorageActive: process.env.ALLOW_LEGACY_FILE === 'true',
    fallbackFileActive: false, // 🛑 Permanently deactivated for production zero-leak safety
    recordCountsInMemory: {
      branches: Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0,
      parcels: Array.isArray(memoryDatabase.parcels) ? memoryDatabase.parcels.length : 0,
      truckManifests: Array.isArray(memoryDatabase.truckManifests) ? memoryDatabase.truckManifests.length : 0,
      users: Array.isArray(memoryDatabase.users) ? memoryDatabase.users.length : 0,
    },
  });
});

// 2.1 Bootstrap Status (Checks if system has been initialized with first admin)
app.get('/api/bootstrap/status', async (req: Request, res: Response) => {
  const pgConnected = isPostgresActive();
  let userCount = 0;
  let branchCount = 0;

  if (pgConnected) {
    try {
      const uRes = await queryWithRetry(async (pool) =>
        pool.query(`SELECT COUNT(*)::int as c FROM orca_entities WHERE collection = 'users'`)
      );
      userCount = uRes.rows[0]?.c || 0;
      const bRes = await queryWithRetry(async (pool) =>
        pool.query(`SELECT COUNT(*)::int as c FROM orca_entities WHERE collection = 'branches'`)
      );
      branchCount = bRes.rows[0]?.c || 0;
    } catch {
      userCount = Array.isArray(memoryDatabase.users) ? memoryDatabase.users.length : 0;
      branchCount = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0;
    }
  } else {
    userCount = Array.isArray(memoryDatabase.users) ? memoryDatabase.users.length : 0;
    branchCount = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0;
  }

  const isBootstrapped = userCount > 0;

  res.json({
    isBootstrapped,
    canBootstrap: !isBootstrapped,
    userCount,
    branchCount,
    postgresConnected: pgConnected,
  });
});

// 2.2 Bootstrap First-Admin Initialization (Creates Super Admin ONLY, 0 Branches)
app.post('/api/bootstrap/init', async (req: Request, res: Response) => {
  const { adminName, username, password, phone } = req.body || {};

  const pgConnected = isPostgresActive();
  let existingUsersCount = 0;

  if (pgConnected) {
    try {
      const uRes = await queryWithRetry(async (pool) =>
        pool.query(`SELECT COUNT(*)::int as c FROM orca_entities WHERE collection = 'users'`)
      );
      existingUsersCount = uRes.rows[0]?.c || 0;
    } catch {
      return res.status(500).json({ success: false, error: 'تعذر التحقق من حالة قاعدة البيانات' });
    }
  } else {
    existingUsersCount = Array.isArray(memoryDatabase.users) ? memoryDatabase.users.length : 0;
  }

  // Locked once bootstrapped unless explicit force parameter is provided
  if (existingUsersCount > 0 && !req.body.force) {
    return res.status(403).json({
      success: false,
      error: 'المنظومة مهيأة مسبقاً بحسابات معتمدة. بوابة التهيئة الأولية مقفلة نهائياً.',
    });
  }

  const finalAdminName = (adminName || username || '').trim();
  const finalUsername = (username || adminName || '').trim();
  const finalPassword = (password || '').trim();

  if (!finalAdminName || !finalPassword) {
    return res.status(400).json({
      success: false,
      error: 'يرجى إدخال اسم مدير النظام وكلمة المرور.',
    });
  }

  const now = new Date().toISOString();
  const cleanUserSlug = finalUsername.toLowerCase().trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const superAdminUser = {
    id: `usr_${cleanUserSlug || 'admin'}`,
    name: finalAdminName,
    username: finalUsername,
    password: finalPassword,
    role: 'super_admin',
    branchId: '', // Will be assigned upon creation of first branch
    canSwitchBranches: true,
    allowedBranchIds: [],
    phone: phone || '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const bootstrapPayload = {
    branches: [],
    users: [superAdminUser],
  };

  try {
    if (pgConnected) {
      await pushAllToPostgres(bootstrapPayload);
      invalidatePostgresCache();
      await refreshMemoryDatabaseFromPostgres(true);
    } else {
      memoryDatabase = bootstrapPayload;
      persistDatabaseToFile();
    }

    broadcastServerEvent('full_sync', {
      timestamp: now,
      source: 'bootstrap_init',
    });

    res.json({
      success: true,
      message: 'تمت تهيئة حساب مدير النظام (Super Admin) بنجاح. يرجى متابعة خطوة إنشاء الفرع الأول وطاقم العمل.',
      user: {
        id: superAdminUser.id,
        name: superAdminUser.name,
        username: superAdminUser.username,
        role: superAdminUser.role,
      },
      branchCount: 0,
      userCount: 1,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل حفظ بيانات مدير النظام' });
  }
});

// 2.3 Create First Branch & Initial Staff (Executes after Bootstrap by Super Admin)
app.post('/api/branches/create-first', async (req: Request, res: Response) => {
  const {
    branchName,
    branchCode,
    branchGovernorate,
    address,
    phone,
    commissionRateShipping,
    commissionRateTransfers,
    requesterRole,
    staff,
  } = req.body || {};

  const pgConnected = isPostgresActive();
  let existingBranchesCount = 0;

  if (pgConnected) {
    try {
      const bRes = await queryWithRetry(async (pool) =>
        pool.query(`SELECT COUNT(*)::int as c FROM orca_entities WHERE collection = 'branches'`)
      );
      existingBranchesCount = bRes.rows[0]?.c || 0;
    } catch {
      existingBranchesCount = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0;
    }
  } else {
    existingBranchesCount = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches.length : 0;
  }

  // Require super_admin role unless 0 branches exist
  if (existingBranchesCount > 0 && requesterRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح: إنشاء الفروع مقصور على مدير النظام حصراً.',
    });
  }

  const finalBranchName = (branchName || '').trim();
  const finalBranchCode = (branchCode || '').trim().toUpperCase();
  const finalGovernorate = (branchGovernorate || 'دمشق').trim();

  if (!finalBranchName || !finalBranchCode) {
    return res.status(400).json({
      success: false,
      error: 'يرجى إدخال اسم الفرع وكود الفرع.',
    });
  }

  const now = new Date().toISOString();
  const branchId = `br_${finalBranchCode.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'main'}`;

  const newBranch = {
    id: branchId,
    code: finalBranchCode,
    name: finalBranchName,
    type: 'main_hub',
    governorate: finalGovernorate,
    commissionRateShipping: Number(commissionRateShipping) || 10,
    commissionRateTransfers: Number(commissionRateTransfers) || 1,
    boxSypBalance: 0,
    boxUsdBalance: 0,
    address: address || `المركز اللوجستي - ${finalGovernorate}`,
    phone: phone || '',
    managerName: finalBranchName,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Staff members (3 roles: hub_manager, inbound_operator, outbound_operator)
  const newStaffUsers: any[] = [];
  if (Array.isArray(staff) && staff.length > 0) {
    staff.forEach((member: any, idx: number) => {
      if (member && member.name && member.username && member.password) {
        const uSlug = member.username.toLowerCase().trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
        const defaultRoles = ['hub_manager', 'inbound_operator', 'outbound_operator'];
        const assignedRole = member.role || defaultRoles[idx] || 'hub_manager';
        newStaffUsers.push({
          id: `usr_${uSlug || `staff_${idx + 1}`}`,
          name: member.name.trim(),
          username: member.username.trim(),
          password: member.password.trim(),
          role: assignedRole,
          branchId: branchId,
          canSwitchBranches: false,
          allowedBranchIds: [branchId],
          phone: member.phone || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  }

  try {
    let currentUsers: any[] = [];
    let currentBranches: any[] = [];

    if (pgConnected) {
      const dbData = await pullAllFromPostgres();
      currentUsers = dbData?.users || [];
      currentBranches = dbData?.branches || [];
    } else {
      currentUsers = Array.isArray(memoryDatabase.users) ? memoryDatabase.users : [];
      currentBranches = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches : [];
    }

    // Update Super Admin user to be bound to this first branch
    const updatedUsers = currentUsers.map((u) => {
      if (u.role === 'super_admin' || !u.branchId) {
        return {
          ...u,
          branchId: branchId,
          allowedBranchIds: Array.from(new Set([...(u.allowedBranchIds || []), branchId])),
          updatedAt: now,
        };
      }
      return u;
    });

    // Add new staff users
    newStaffUsers.forEach((su) => {
      if (!updatedUsers.some((u) => u.id === su.id || u.username === su.username)) {
        updatedUsers.push(su);
      }
    });

    // Add new branch
    const updatedBranches = [...currentBranches.filter((b) => b.id !== branchId), newBranch];

    const fullPayload = {
      branches: updatedBranches,
      users: updatedUsers,
    };

    if (pgConnected) {
      await pushAllToPostgres(fullPayload);
      invalidatePostgresCache();
      await refreshMemoryDatabaseFromPostgres(true);
    } else {
      memoryDatabase.branches = updatedBranches;
      memoryDatabase.users = updatedUsers;
      persistDatabaseToFile();
    }

    broadcastServerEvent('full_sync', {
      timestamp: now,
      source: 'branches_create_first',
    });

    res.json({
      success: true,
      message: 'تم إنشاء الفرع الأول وطاقم العمل بنجاح!',
      branch: newBranch,
      createdUsersCount: newStaffUsers.length,
      totalUsersCount: updatedUsers.length,
      totalBranchesCount: updatedBranches.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل إنشاء الفرع الأول' });
  }
});

// 2.4 Admin User Creation (Strictly Super Admin Only Endpoint)
app.post('/api/admin/users/create', async (req: Request, res: Response) => {
  const { user, requesterRole } = req.body || {};

  if (requesterRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح: إضافة الحسابات والموظفين مقتصرة على مدير النظام (Super Admin) حصراً.',
    });
  }

  if (!user || !user.name || !user.username || !user.password || !user.branchId) {
    return res.status(400).json({
      success: false,
      error: 'يرجى استكمال جميع بيانات الموظف والفرع التابع له.',
    });
  }

  const pgConnected = isPostgresActive();
  const now = new Date().toISOString();
  const uSlug = user.username.toLowerCase().trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');

  const newUser = {
    ...user,
    id: user.id || `usr_${uSlug}`,
    branchId: user.branchId,
    createdAt: user.createdAt || now,
    updatedAt: now,
  };

  try {
    let currentUsers: any[] = [];
    if (pgConnected) {
      const dbData = await pullAllFromPostgres();
      currentUsers = dbData?.users || [];
    } else {
      currentUsers = Array.isArray(memoryDatabase.users) ? memoryDatabase.users : [];
    }

    if (currentUsers.some((u) => u.username === newUser.username && u.id !== newUser.id)) {
      return res.status(400).json({
        success: false,
        error: 'اسم المستخدم مستخدم مسبقاً، يرجى اختيار اسم مستخدم آخر.',
      });
    }

    const updatedUsers = [...currentUsers.filter((u) => u.id !== newUser.id), newUser];

    if (pgConnected) {
      await pushAllToPostgres({ users: updatedUsers });
      invalidatePostgresCache();
      await refreshMemoryDatabaseFromPostgres(true);
    } else {
      memoryDatabase.users = updatedUsers;
      persistDatabaseToFile();
    }

    broadcastServerEvent('user_updated', {
      user: newUser,
      timestamp: now,
    });

    res.json({
      success: true,
      message: `تم إنشاء حساب الموظف [${newUser.name}] بنجاح`,
      user: newUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل إضافة المستخدم' });
  }
});

// 2.5 Admin Unified Bulk Save for Branches and Users
app.post('/api/admin/branches-and-users/bulk-save', async (req: Request, res: Response) => {
  const { branches: incomingBranches, users: incomingUsers, requesterRole } = req.body || {};

  if (requesterRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'غير مصرح: تحديث شجرة الفروع والمستخدمين مقتصر على مدير النظام (Super Admin) حصراً.',
    });
  }

  if (!Array.isArray(incomingBranches) || !Array.isArray(incomingUsers)) {
    return res.status(400).json({
      success: false,
      error: 'مصفوفة الفروع أو المستخدمين غير صحيحة.',
    });
  }

  const pgConnected = isPostgresActive();
  const now = new Date().toISOString();

  try {
    let currentUsers: any[] = [];
    let currentBranches: any[] = [];

    if (pgConnected) {
      const dbData = await pullAllFromPostgres();
      currentUsers = dbData?.users || [];
      currentBranches = dbData?.branches || [];
    } else {
      currentUsers = Array.isArray(memoryDatabase.users) ? memoryDatabase.users : [];
      currentBranches = Array.isArray(memoryDatabase.branches) ? memoryDatabase.branches : [];
    }

    // Validate Uniqueness of incoming branch codes
    const incomingCodes = new Set<string>();
    for (const ib of incomingBranches) {
      const code = (ib.code || '').trim().toUpperCase();
      if (!code) {
        return res.status(400).json({ success: false, error: `كود الفرع مطلوب للفرع [${ib.name || 'بدون اسم'}]` });
      }
      if (incomingCodes.has(code)) {
        return res.status(400).json({ success: false, error: `كود الفرع (${code}) مكرر في الفروع المرسلة` });
      }
      incomingCodes.add(code);

      // Check against other existing branches with different ID
      const existingWithSameCode = currentBranches.find((b) => b.code?.toUpperCase() === code && b.id !== ib.id);
      if (existingWithSameCode) {
        return res.status(400).json({ success: false, error: `كود الفرع (${code}) مستخدم مسبقاً في فرع [${existingWithSameCode.name}]` });
      }
    }

    // Validate Uniqueness of incoming usernames
    const incomingUsernames = new Set<string>();
    for (const iu of incomingUsers) {
      const uname = (iu.username || '').trim().toLowerCase();
      if (!uname) {
        return res.status(400).json({ success: false, error: `اسم المستخدم مطلوب للموظف [${iu.name || 'بدون اسم'}]` });
      }
      if (incomingUsernames.has(uname)) {
        return res.status(400).json({ success: false, error: `اسم المستخدم (@${uname}) مكرر في الموظفين المرسلون` });
      }
      incomingUsernames.add(uname);

      // Check against other existing users with different ID
      const existingWithSameUsername = currentUsers.find((u) => u.username?.toLowerCase() === uname && u.id !== iu.id);
      if (existingWithSameUsername) {
        return res.status(400).json({ success: false, error: `اسم المستخدم (@${uname}) محجوز مسبقاً لحساب [${existingWithSameUsername.name}]` });
      }
    }

    // Merge incoming branches
    const updatedBranches = [...currentBranches];
    incomingBranches.forEach((ib: any) => {
      const idx = updatedBranches.findIndex((b) => b.id === ib.id || (ib.code && b.code === ib.code));
      if (idx >= 0) {
        updatedBranches[idx] = { ...updatedBranches[idx], ...ib, updatedAt: now };
      } else {
        updatedBranches.push({ ...ib, createdAt: ib.createdAt || now, updatedAt: now });
      }
    });

    // Merge incoming users
    const updatedUsers = [...currentUsers];
    incomingUsers.forEach((iu: any) => {
      const idx = updatedUsers.findIndex((u) => u.id === iu.id || (iu.username && u.username === iu.username));
      if (idx >= 0) {
        updatedUsers[idx] = { ...updatedUsers[idx], ...iu, updatedAt: now };
      } else {
        updatedUsers.push({ ...iu, createdAt: iu.createdAt || now, updatedAt: now });
      }
    });

    const fullPayload = {
      branches: updatedBranches,
      users: updatedUsers,
    };

    if (pgConnected) {
      await pushAllToPostgres(fullPayload);
      invalidatePostgresCache();
      await refreshMemoryDatabaseFromPostgres(true);
    } else {
      memoryDatabase.branches = updatedBranches;
      memoryDatabase.users = updatedUsers;
      persistDatabaseToFile();
    }

    broadcastServerEvent('full_sync', {
      timestamp: now,
      source: 'admin_bulk_save',
    });

    res.json({
      success: true,
      message: 'تم حفظ شجرة الفروع والمستخدمين بنجاح',
      savedBranchesCount: incomingBranches.length,
      savedUsersCount: incomingUsers.length,
      branches: updatedBranches,
      users: updatedUsers,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'فشل حفظ الفروع والمستخدمين' });
  }
});

// 3. Trigger PostgreSQL Reconnect / Schema Verification (Strict ZERO Auto-Seed)
app.post('/api/db/connect', async (req: Request, res: Response) => {
  const { databaseUrl } = req.body;
  if (databaseUrl && typeof databaseUrl === 'string') {
    process.env.DATABASE_URL = databaseUrl.trim();
  }

  const success = await initPostgres();
  const status = await getPostgresStatus();

  if (success) {
    // When connecting, read directly from PostgreSQL. NEVER auto-push local cached memory to a clean DB!
    const pgData = await pullAllFromPostgres();
    memoryDatabase = pgData || {};
    persistDatabaseToFile();
    invalidatePostgresCache();
  }

  res.json({
    success,
    status,
    message: success
      ? 'تم الاتصال بقاعدة بيانات PostgreSQL وتجهيز الجداول بنجاح دون أي بيانات تجريبية.'
      : `فشل الاتصال: ${status.error || 'يرجى التأكد من صحة بيانات الاتصال'}`
  });
});

// 4.1 Universal Zero-Wipe Protocol: Purge All Operational Data from PostgreSQL, Server & Connected Clients
app.post(['/api/db/clear-operational', '/api/sync/clear', '/api/db/init-clean', '/api/db/zero-wipe'], async (req: Request, res: Response) => {
  try {
    // Reset in-memory database to absolute zero
    memoryDatabase = {
      users: [
        {
          id: 'usr_general_manager',
          name: 'سليمان',
          username: 'سليمان',
          password: '111222000',
          role: 'super_admin',
          branchId: '',
          canSwitchBranches: true,
          allowedBranchIds: [],
          phone: '',
          isActive: true,
        },
      ],
      branches: [],
      parcels: [],
      truckManifests: [],
      courierManifests: [],
      transactions: [],
      settlements: [],
      shiftSettlements: [],
      vouchers: [],
      customers: [],
      vehicles: [],
      employees: [],
      payrollRecords: [],
      expenses: [],
      expenseCategories: [],
      fixedAssets: [],
      directMessages: [],
      notifications: [],
      pricingRules: [],
      auditLogs: [],
      brandingSettings: memoryDatabase.brandingSettings || [],
      codSettings: memoryDatabase.codSettings || [],
      courierIntakeSettlements: [],
    };

    // Wipe physical file cache completely
    try {
      if (fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(memoryDatabase, null, 2), 'utf-8');
      }
    } catch (fsErr) {
      console.warn('[Server] Error updating DB_FILE on zero wipe:', fsErr);
    }

    persistDatabaseToFile();
    invalidatePostgresCache();

    let pgCleared = false;
    if (isPostgresActive()) {
      pgCleared = await clearPostgresOperationalData();
    }

    const resetEpoch = Date.now().toString();

    // Broadcast instant zero-wipe reset event to all active SSE subscribers across all devices/branches
    broadcastServerEvent('zero_wipe_reset', {
      epoch: resetEpoch,
      timestamp: new Date().toISOString(),
      message: 'universal_zero_wipe_executed',
    });
    broadcastServerEvent('clear_operational', {
      epoch: resetEpoch,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      epoch: resetEpoch,
      message: 'تم تصفير قاعدة البيانات بالكامل وتطهير السيرفر وكافة الأجهزة المتصلة بنجاح.',
      postgresCleared: pgCleared,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Generate & Download Ready-to-use PostgreSQL .sql Dump
app.get('/api/db/export-sql', async (req: Request, res: Response) => {
  try {
    const dump = await generateSqlDump(memoryDatabase);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orca-express-postgres-${new Date().toISOString().slice(0, 10)}.sql"`
    );
    res.send(dump);
  } catch (err: any) {
    res.status(500).send(`Error generating SQL dump: ${err.message}`);
  }
});

// 5.1 Financial Audit Trail from PostgreSQL
app.get('/api/audit/financial', async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const logs = await getFinancialAuditLogs(limit);
    res.json({
      success: true,
      count: logs.length,
      isPostgres: isPostgresActive(),
      data: logs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// 5.2 Migrate JSONB Entities to Relational App Tables (app_*)
app.post('/api/db/migrate-to-app-tables', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dry === '1' || req.body?.dryRun === true;
    const result = await migrateCollectionsToAppTables(dryRun);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// =============================================================
// SERVER-AUTHORITATIVE REST API V2 (Direct Relational Access)
// =============================================================

// 1. GET /api/v2/branches
app.get('/api/v2/branches', async (req: Request, res: Response) => {
  if (!isPostgresActive()) {
    return res.status(503).json({
      success: false,
      error: 'PostgreSQL database is currently unavailable or not connected',
    });
  }

  try {
    const result = await queryWithRetry(async (pool) =>
      pool.query(`
        SELECT 
          id,
          name,
          code,
          governorate,
          type,
          parent_hub_id AS "parentHubId",
          box_syp_balance::float AS "boxSypBalance",
          box_usd_balance::float AS "boxUsdBalance",
          opening_balance_syp::float AS "openingBalanceSyp",
          opening_balance_usd::float AS "openingBalanceUsd",
          phone,
          address,
          commission_rate_shipping::float AS "commissionRateShipping",
          commission_rate_transfers::float AS "commissionRateTransfers",
          is_active AS "isActive",
          metadata,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM app_branches
        ORDER BY name ASC
      `)
    );

    console.log(`[API v2] GET /api/v2/branches: ${result.rows.length} rows`);
    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err: any) {
    console.error('[API v2] GET /api/v2/branches error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// 2. GET /api/v2/users
app.get('/api/v2/users', async (req: Request, res: Response) => {
  if (!isPostgresActive()) {
    return res.status(503).json({
      success: false,
      error: 'PostgreSQL database is currently unavailable or not connected',
    });
  }

  try {
    const { branchId, role, q } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (branchId && typeof branchId === 'string' && branchId.trim()) {
      params.push(branchId.trim());
      conditions.push(`branch_id = $${params.length}`);
    }

    if (role && typeof role === 'string' && role.trim()) {
      params.push(role.trim());
      conditions.push(`role = $${params.length}`);
    }

    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(username) LIKE $${params.length} OR LOWER(full_name) LIKE $${params.length} OR phone LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryWithRetry(async (pool) =>
      pool.query(`
        SELECT 
          id,
          username,
          full_name AS "fullName",
          role,
          branch_id AS "branchId",
          phone,
          is_active AS "isActive",
          permissions,
          last_login_at AS "lastLoginAt",
          metadata,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM app_users
        ${whereClause}
        ORDER BY full_name ASC
      `, params)
    );

    console.log(`[API v2] GET /api/v2/users: ${result.rows.length} rows`);
    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err: any) {
    console.error('[API v2] GET /api/v2/users error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// 3. GET /api/v2/parcels
app.get('/api/v2/parcels', async (req: Request, res: Response) => {
  if (!isPostgresActive()) {
    return res.status(503).json({
      success: false,
      error: 'PostgreSQL database is currently unavailable or not connected',
    });
  }

  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const rawLimit = parseInt((req.query.limit as string) || '50', 10);
    const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    const { status, originBranchId, destinationHubId, q } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && typeof status === 'string' && status.trim()) {
      params.push(status.trim());
      conditions.push(`handling_status = $${params.length}`);
    }

    if (originBranchId && typeof originBranchId === 'string' && originBranchId.trim()) {
      params.push(originBranchId.trim());
      conditions.push(`origin_branch_id = $${params.length}`);
    }

    if (destinationHubId && typeof destinationHubId === 'string' && destinationHubId.trim()) {
      params.push(destinationHubId.trim());
      conditions.push(`destination_hub_id = $${params.length}`);
    }

    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim().toUpperCase()}%`);
      conditions.push(`(
        UPPER(tracking_number) LIKE $${params.length} OR 
        UPPER(paper_receipt_number) LIKE $${params.length} OR
        sender_data->>'phone' LIKE $${params.length} OR
        receiver_data->>'phone' LIKE $${params.length} OR
        sender_data->>'name' ILIKE $${params.length} OR
        receiver_data->>'name' ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countRes = await queryWithRetry(async (pool) =>
      pool.query(`SELECT COUNT(*) AS total FROM app_parcels ${whereClause}`, params)
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // Data query with LIMIT and OFFSET
    const queryParams = [...params, limit, offset];
    const limitParamIdx = params.length + 1;
    const offsetParamIdx = params.length + 2;

    const result = await queryWithRetry(async (pool) =>
      pool.query(`
        SELECT 
          id,
          tracking_number AS "trackingNumber",
          paper_receipt_number AS "paperReceiptNumber",
          origin_branch_id AS "originBranchId",
          destination_hub_id AS "destinationHubId",
          current_location_id AS "currentLocationId",
          handling_status AS "handlingStatus",
          payment_type AS "paymentType",
          shipping_cost::float AS "shippingCost",
          currency,
          cod_amount::float AS "codAmount",
          cod_currency AS "codCurrency",
          cod_paid_to_sender AS "codPaidToSender",
          cod_payout_voucher_id AS "codPayoutVoucherId",
          cod_payout_at AS "codPayoutAt",
          cod_payout_by_user_id AS "codPayoutByUserId",
          package_type AS "packageType",
          weight_kg::float AS "weightKg",
          pieces_count AS "piecesCount",
          content_description AS "contentDescription",
          sender_data AS "sender",
          receiver_data AS "receiver",
          truck_manifest_id AS "truckManifestId",
          courier_manifest_id AS "courierManifestId",
          delivered_at AS "deliveredAt",
          delivered_by_user_id AS "deliveredByUserId",
          returned_at AS "returnedAt",
          return_reason AS "returnReason",
          metadata,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM app_parcels
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      `, queryParams)
    );

    console.log(`[API v2] GET /api/v2/parcels: ${result.rows.length} rows (page ${page}/${totalPages}, total ${total})`);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err: any) {
    console.error('[API v2] GET /api/v2/parcels error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

// -------------------------------------------------------------
// REAL-TIME SERVER-SENT EVENTS (SSE) BROADCASTER (< 300ms Instant Push)
// -------------------------------------------------------------
const sseClients = new Set<Response>();

function broadcastServerEvent(eventType: string, payload: any) {
  if (sseClients.size === 0) return;
  const dataString = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });
  const message = `event: ${eventType}\ndata: ${dataString}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat for SSE connections every 15s to keep connections alive through proxies / mobile gateways
setInterval(() => {
  if (sseClients.size === 0) return;
  const pingMessage = `event: ping\ndata: {"time":${Date.now()}}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(pingMessage);
    } catch {
      sseClients.delete(client);
    }
  }
}, 15000);

// SSE Subscription Endpoint for instantaneous cloud-to-client push
app.get(['/api/sync/events', '/api/vps/events'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send initial connected acknowledgement
  res.write(`event: connected\ndata: {"connected":true,"clientsCount":${sseClients.size + 1},"serverTime":"${new Date().toISOString()}"}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 6. Full Database Sync (Pull)
app.get('/api/sync/pull', async (req: Request, res: Response) => {
  const branchId = req.query.branchId as string;

  // Use cached Postgres data if fresh (< 2.5s) to avoid bufferbloat & connection pool exhaustion
  await refreshMemoryDatabaseFromPostgres(false);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    branchId: branchId || 'all',
    source: isPostgresActive() ? 'PostgreSQL' : 'LocalStorageFallback',
    postgres: {
      connected: isPostgresActive(),
    },
    data: memoryDatabase,
  });
});

// Helper to extract highest timestamp from an item
function getItemTimestampMs(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  if (typeof item._serverUpdatedAtMs === 'number' && item._serverUpdatedAtMs > 0) {
    return item._serverUpdatedAtMs;
  }
  const candidates = [
    item.updatedAt,
    item.timestamp,
    item.closedAt,
    item.approvedAt,
    item.dispatchedAt,
    item.receivedAt,
    item.arrivedAtDestAt,
    item.createdAt,
    item.date,
    item._syncedAt,
  ];
  let max = 0;
  for (const c of candidates) {
    if (c) {
      const ms = new Date(c).getTime();
      if (!isNaN(ms) && ms > max) max = ms;
    }
  }
  return max > 0 ? max : Date.now();
}

// 6.1 Lightweight Timestamp Comparison & Digest Endpoint (Background Worker)
app.get('/api/sync/timestamps', async (req: Request, res: Response) => {
  // Use cached Postgres data if fresh (< 2.5s)
  await refreshMemoryDatabaseFromPostgres(false);

  const ALL_SYNC_COLLECTIONS = [
    'branches',
    'users',
    'parcels',
    'truckManifests',
    'courierManifests',
    'transactions',
    'shiftSettlementVouchers',
    'settlements',
    'vouchers',
    'customers',
    'pricingRules',
    'expenses',
    'expenseCategories',
    'vehicles',
    'employees',
    'payrollRecords',
    'fixedAssets',
    'directMessages',
    'notifications',
    'brandingSettings',
    'codSettings',
    'auditLogs',
    'courierIntakeSettlements',
  ];

  const digests: Record<string, { count: number; latestTimestamp: string; maxTimeMs: number }> = {};

  for (const col of ALL_SYNC_COLLECTIONS) {
    const list = Array.isArray(memoryDatabase[col]) ? memoryDatabase[col] : [];
    let maxTimeMs = 0;
    let latestTimestamp = '1970-01-01T00:00:00.000Z';

    for (const it of list) {
      const tMs = getItemTimestampMs(it);
      if (tMs > maxTimeMs) {
        maxTimeMs = tMs;
        latestTimestamp = new Date(tMs).toISOString();
      }
    }

    digests[col] = {
      count: list.length,
      latestTimestamp,
      maxTimeMs,
    };
  }

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    source: isPostgresActive() ? 'PostgreSQL' : 'FileFallback',
    digests,
  });
});

// Helper to strip heavy Base64 image fields from periodic sync delta
function stripHeavyBase64Fields(item: any): any {
  if (!item || typeof item !== 'object') return item;

  // Shallow copy
  const cleaned = { ...item };

  // Heavy image fields that should NOT be in periodic delta sync
  const HEAVY_FIELDS = [
    'senderIdPhotoFront',
    'senderIdPhotoBack',
    'receiverSignature',
    'nationalIdPhotoUrl',
    'nationalIdBackPhotoUrl',
    'signatureUrl',
    'idPhotoFront',
    'idPhotoBack',
    'avatar',
    'photoUrl',
    'logoUrl',
    'logo',
    'stampUrl',
    'signatureImageUrl',
  ];

  for (const field of HEAVY_FIELDS) {
    if (cleaned[field] && typeof cleaned[field] === 'string' && cleaned[field].length > 500) {
      cleaned[field] = '__FETCH_ON_DEMAND__';
    }
  }

  // Nested structures
  if (cleaned.sender && typeof cleaned.sender === 'object') {
    cleaned.sender = stripHeavyBase64Fields(cleaned.sender);
  }
  if (cleaned.receiver && typeof cleaned.receiver === 'object') {
    cleaned.receiver = stripHeavyBase64Fields(cleaned.receiver);
  }

  return cleaned;
}

// 6.2 Timestamp-Based Delta Fetch (Pulls ONLY modified records for background reconciliation)
app.post('/api/sync/delta', async (req: Request, res: Response) => {
  const clientTimestamps: Record<string, string | number> = req.body.timestamps || {};

  // Use cached Postgres data if fresh (< 2.5s)
  await refreshMemoryDatabaseFromPostgres(false);

  const delta: Record<string, any[]> = {};
  let totalChanged = 0;
  const MAX_DELTA_PER_COLLECTION = 50;

  const ALL_SYNC_COLLECTIONS = [
    'branches',
    'users',
    'parcels',
    'truckManifests',
    'courierManifests',
    'transactions',
    'shiftSettlementVouchers',
    'settlements',
    'vouchers',
    'customers',
    'pricingRules',
    'expenses',
    'expenseCategories',
    'vehicles',
    'employees',
    'payrollRecords',
    'fixedAssets',
    'directMessages',
    'notifications',
    'brandingSettings',
    'codSettings',
    'auditLogs',
    'courierIntakeSettlements',
  ];

  for (const col of ALL_SYNC_COLLECTIONS) {
    const list = Array.isArray(memoryDatabase[col]) ? memoryDatabase[col] : [];
    const rawClientTime = clientTimestamps[col];
    const clientTimeMs = rawClientTime ? new Date(rawClientTime).getTime() : 0;

    // ✅ إرسال brandingSettings/codSettings فقط إذا تغيّرا فعلاً
    if (col === 'brandingSettings' || col === 'codSettings') {
      if (list.length > 0 && clientTimeMs > 0) {
        const maxTime = Math.max(
          ...list.map((it: any) => getItemTimestampMs(it))
        );
        if (maxTime > clientTimeMs) {
          delta[col] = list.map(stripHeavyBase64Fields);
          totalChanged += list.length;
        }
      }
      continue;
    }

    // If clientTimeMs is 0, return current list if it has items (capped and stripped)
    if (clientTimeMs === 0) {
      if (list.length > 0) {
        delta[col] = list.slice(0, MAX_DELTA_PER_COLLECTION).map(stripHeavyBase64Fields);
        totalChanged += Math.min(list.length, MAX_DELTA_PER_COLLECTION);
      }
      continue;
    }

    // Filter for records modified after clientTimeMs (with 5000ms clock-skew safety window)
    const CLOCK_SKEW_SAFETY_MS = 5000;
    const effectiveClientThreshold = Math.max(0, clientTimeMs - CLOCK_SKEW_SAFETY_MS);
    const modifiedItems = list.filter((it: any) => {
      const itemTimeMs = getItemTimestampMs(it);
      return itemTimeMs > effectiveClientThreshold;
    });

    if (modifiedItems.length > 0) {
      delta[col] = modifiedItems
        .slice(0, MAX_DELTA_PER_COLLECTION)
        .map(stripHeavyBase64Fields);
      totalChanged += Math.min(modifiedItems.length, MAX_DELTA_PER_COLLECTION);
    }
  }

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    totalChanged,
    delta,
  });
});

// Endpoint to fetch heavy parcel photos on demand when viewing details
app.get('/api/parcels/:parcelId/photos', async (req: Request, res: Response) => {
  const { parcelId } = req.params;
  try {
    if (!isPostgresActive()) {
      const parcels = Array.isArray(memoryDatabase.parcels) ? memoryDatabase.parcels : [];
      const parcel = parcels.find(
        (p: any) => p.id === parcelId || p.trackingNumber === parcelId
      );
      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }
      return res.json({
        senderIdPhotoFront: parcel.senderIdPhotoFront || null,
        senderIdPhotoBack: parcel.senderIdPhotoBack || null,
        receiverSignature: parcel.receiverSignature || null,
        nationalIdPhotoUrl: parcel.nationalIdPhotoUrl || null,
        nationalIdBackPhotoUrl: parcel.nationalIdBackPhotoUrl || null,
        signatureUrl: parcel.signatureUrl || null,
      });
    }

    const result = await queryWithRetry(async (pool) =>
      pool.query(
        `SELECT data FROM orca_entities 
         WHERE collection = 'parcels' AND id = $1`,
        [parcelId]
      )
    );
    if (result.rows.length === 0) {
      const trackingResult = await queryWithRetry(async (pool) =>
        pool.query(
          `SELECT data FROM orca_entities 
           WHERE collection = 'parcels' AND data->>'trackingNumber' = $1`,
          [parcelId]
        )
      );
      if (trackingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Parcel not found' });
      }
      const parcel = trackingResult.rows[0].data;
      return res.json({
        senderIdPhotoFront: parcel.senderIdPhotoFront || null,
        senderIdPhotoBack: parcel.senderIdPhotoBack || null,
        receiverSignature: parcel.receiverSignature || null,
        nationalIdPhotoUrl: parcel.nationalIdPhotoUrl || null,
        nationalIdBackPhotoUrl: parcel.nationalIdBackPhotoUrl || null,
        signatureUrl: parcel.signatureUrl || null,
      });
    }
    const parcel = result.rows[0].data;
    return res.json({
      senderIdPhotoFront: parcel.senderIdPhotoFront || null,
      senderIdPhotoBack: parcel.senderIdPhotoBack || null,
      receiverSignature: parcel.receiverSignature || null,
      nationalIdPhotoUrl: parcel.nationalIdPhotoUrl || null,
      nationalIdBackPhotoUrl: parcel.nationalIdBackPhotoUrl || null,
      signatureUrl: parcel.signatureUrl || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================
// CENTRAL ID PHOTOS STORAGE & RETRIEVAL API (app_photos)
// =============================================================

// POST /api/photos — Upload / Save photo
app.post('/api/photos', async (req: Request, res: Response) => {
  try {
    const { key, data, mimeType } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: 'key required' });
    }
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ success: false, error: 'data required' });
    }

    // Extract base64 from data URL
    let base64 = data;
    let mime = mimeType || 'image/jpeg';
    if (data.startsWith('data:')) {
      const parts = data.split(',');
      const meta = parts[0];
      base64 = parts[1] || '';
      mime = meta.split(';')[0].replace('data:', '') || 'image/jpeg';
    }

    const sizeBytes = Math.ceil(base64.length * 0.75);

    // Save in memory cache
    if (!memoryDatabase.photos) {
      (memoryDatabase as any).photos = {};
    }
    (memoryDatabase as any).photos[key] = {
      key,
      base64,
      mime,
      sizeBytes,
      createdAt: new Date().toISOString(),
    };

    if (isPostgresActive()) {
      await queryWithRetry(async (pool) =>
        pool.query(
          `INSERT INTO app_photos (key, base64_data, mime_type, size_bytes, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (key) DO UPDATE SET 
             base64_data = EXCLUDED.base64_data,
             mime_type = EXCLUDED.mime_type,
             size_bytes = EXCLUDED.size_bytes,
             created_at = NOW()`,
          [key, base64, mime, sizeBytes]
        )
      );
    }

    console.log(`[Photos] Saved ${key} (${sizeBytes} bytes)`);
    return res.json({ success: true, key });
  } catch (err: any) {
    console.error('[Photos] Save failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/photos/:key — Retrieve photo by key
app.get('/api/photos/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;

    // Check PostgreSQL if active
    if (isPostgresActive()) {
      const result = await queryWithRetry(async (pool) =>
        pool.query(
          `SELECT base64_data, mime_type FROM app_photos WHERE key = $1`,
          [key]
        )
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const dataUrl = `data:${row.mime_type || 'image/jpeg'};base64,${row.base64_data}`;
        return res.json({
          success: true,
          key,
          data: dataUrl,
        });
      }
    }

    // Fallback to memoryDatabase
    const memPhoto = (memoryDatabase as any)?.photos?.[key];
    if (memPhoto) {
      const dataUrl = `data:${memPhoto.mime || 'image/jpeg'};base64,${memPhoto.base64}`;
      return res.json({
        success: true,
        key,
        data: dataUrl,
      });
    }

    return res.status(404).json({ success: false, error: 'not found' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Full Database Sync (Push / Seed)
app.post('/api/sync/push', async (req: Request, res: Response) => {
  const incomingData = req.body;
  if (!incomingData || typeof incomingData !== 'object') {
    return res.status(400).json({ success: false, error: 'بيانات غير صالحة' });
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // Merge incoming data keys into memoryDatabase with non-destructive union & guaranteed timestamping
  Object.keys(incomingData).forEach((key) => {
    if (incomingData[key] !== undefined) {
      if (Array.isArray(incomingData[key])) {
        const incomingList = incomingData[key];
        // CRITICAL PROTECTION: If client sends empty array ([]), NEVER wipe existing server data!
        if (incomingList.length === 0) {
          return;
        }

        const existingList = Array.isArray(memoryDatabase[key]) ? memoryDatabase[key] : [];
        if (existingList.length === 0) {
          memoryDatabase[key] = incomingList.map((it: any) => ({
            ...it,
            updatedAt: it.updatedAt || nowIso,
            createdAt: it.createdAt || nowIso,
            _serverUpdatedAtMs: nowMs,
          }));
        } else {
          // Merge by canonical unique key
          const itemMap = new Map<string, any>();
          for (const item of existingList) {
            const idKey = item.id || item.trackingNumber || item.manifestNumber || item.code || item.voucherNumber || item.username;
            if (idKey) itemMap.set(String(idKey), item);
          }

          for (const it of incomingList) {
            const stamped = {
              ...it,
              updatedAt: it.updatedAt || nowIso,
              createdAt: it.createdAt || nowIso,
              _serverUpdatedAtMs: nowMs,
            };
            const idKey = stamped.id || stamped.trackingNumber || stamped.manifestNumber || stamped.code || stamped.voucherNumber || stamped.username;
            if (idKey) {
              const ex = itemMap.get(String(idKey));
              if (ex && key === 'parcels') {
                itemMap.set(String(idKey), mergeParcelSafely(ex, stamped));
              } else if (ex && key === 'customers') {
                itemMap.set(String(idKey), mergeCustomerSafely(ex, stamped));
              } else if (ex && key === 'users') {
                itemMap.set(String(idKey), mergeUserSafely(ex, stamped));
              } else if (ex && key === 'branches') {
                itemMap.set(String(idKey), mergeBranchSafely(ex, stamped));
              } else if (ex) {
                itemMap.set(String(idKey), { ...ex, ...stamped });
              } else {
                itemMap.set(String(idKey), stamped);
              }
            } else {
              itemMap.set(`gen_${Math.random()}`, stamped);
            }
          }
          memoryDatabase[key] = Array.from(itemMap.values());
        }
      } else if (incomingData[key] && typeof incomingData[key] === 'object') {
        memoryDatabase[key] = [{
          ...incomingData[key],
          updatedAt: nowIso,
          createdAt: (incomingData[key] as any).createdAt || nowIso,
          _serverUpdatedAtMs: nowMs,
        }];
      } else {
        memoryDatabase[key] = incomingData[key];
      }
    }
  });

  persistDatabaseToFile();
  invalidatePostgresCache();

  // If PostgreSQL is active, push to Postgres as well
  let pgSaved = 0;
  if (isPostgresActive()) {
    try {
      pgSaved = await pushAllToPostgres(memoryDatabase);
    } catch (err) {
      console.error('[PostgreSQL] Push failed:', err);
    }
  }

  // Broadcast full_sync event to all active clients
  broadcastServerEvent('full_sync', { timestamp: nowIso });

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: isPostgresActive() ? 'PostgreSQL' : 'FileFallback',
    pgRecordsSaved: pgSaved,
    message: 'تم حفظ ومزامنة قاعدة البيانات بالكامل على السيرفر بنجاح.',
  });
});

function normalizePhoneForComparison(phone?: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00963')) digits = digits.slice(5);
  else if (digits.startsWith('963')) digits = digits.slice(3);
  while (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function normalizeArabicComparison(text?: string): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

// 8. Atomic Item Sync (Create / Update / Delete in realtime)
app.post('/api/sync/item', async (req: Request, res: Response) => {
  const { collection, item, action, itemId } = req.body;

  if (!collection || typeof collection !== 'string' || !ALLOWED_COLLECTIONS.has(collection)) {
    return res.status(400).json({ success: false, error: 'اسم المجموعة غير صالح (invalid or unauthorized collection name)' });
  }

  // ⚠️ CRITICAL: For critical collections, require PostgreSQL.
  // Never silently succeed with FileFallback in production.
  const isCritical = CRITICAL_COLLECTIONS.has(collection);

  if (isCritical && !isPostgresActive()) {
    console.error(
      `[Sync] ⚠️ REJECTED critical write (${collection}/${itemId || item?.id}): ` +
      `PostgreSQL is not connected.`
    );
    return res.status(503).json({
      success: false,
      error: 'قاعدة بيانات PostgreSQL غير متصلة. تم رفض العملية الحرجة لمنع فقدان البيانات.',
      storage: 'PostgreSQL_required',
      collection,
      itemId: itemId || item?.id,
    });
  }

  if (!Array.isArray(memoryDatabase[collection])) {
    memoryDatabase[collection] = [];
  }

  const list = memoryDatabase[collection] as any[];

  if (action === 'delete') {
    const targetId = itemId || item?.id;
    memoryDatabase[collection] = list.filter(
      (x) =>
        x.id !== targetId &&
        (!itemId || x.trackingNumber !== itemId) &&
        (!itemId || x.manifestNumber !== itemId) &&
        (!itemId || x.username !== itemId) &&
        (!itemId || x.code !== itemId) &&
        (!itemId || x.voucherNumber !== itemId)
    );
  } else {
    // Upsert (insert or update)
    const targetId = item?.id;
    const itemNormPhone = normalizePhoneForComparison(item?.phone || item?.secondaryPhone);
    const itemNormName = normalizeArabicComparison(item?.fullName);
    const itemNid = item?.nationalId ? String(item.nationalId).replace(/\D/g, '') : '';

    const index = list.findIndex((x) => {
      if (targetId && x.id === targetId) return true;

      if (collection === 'customers') {
        const xNid = x.nationalId ? String(x.nationalId).replace(/\D/g, '') : '';
        if (itemNid.length >= 7 && xNid.length >= 7 && itemNid === xNid) return true;

        const xNormPhone = normalizePhoneForComparison(x.phone || x.secondaryPhone);
        if (itemNormPhone.length >= 6 && xNormPhone.length >= 6 && itemNormPhone === xNormPhone) return true;

        const xNormName = normalizeArabicComparison(x.fullName);
        if (itemNormName.length >= 3 && xNormName.length >= 3 && itemNormName === xNormName) {
          if (itemNormPhone && xNormPhone && itemNormPhone !== xNormPhone) return false;
          return true;
        }
        return false;
      }

      return (
        (collection === 'users' && item?.username && x.username && item.username.trim().toLowerCase() === x.username.trim().toLowerCase()) ||
        (collection === 'branches' && item?.code && x.code && item.code.trim().toUpperCase() === x.code.trim().toUpperCase()) ||
        (collection === 'vouchers' && item?.voucherNumber && x.voucherNumber === item.voucherNumber) ||
        (collection === 'courierIntakeSettlements' && item?.voucherNumber && x.voucherNumber === item.voucherNumber) ||
        (collection === 'shiftSettlementVouchers' && item?.voucherNumber && x.voucherNumber === item.voucherNumber) ||
        (item?.trackingNumber && x.trackingNumber && x.trackingNumber.trim().toUpperCase() === item.trackingNumber.trim().toUpperCase()) ||
        (item?.manifestNumber && x.manifestNumber === item.manifestNumber)
      );
    });
    if (index >= 0) {
      if (collection === 'parcels') {
        list[index] = mergeParcelSafely(list[index], item);
      } else if (collection === 'customers') {
        list[index] = mergeCustomerSafely(list[index], item);
      } else if (collection === 'users') {
        list[index] = mergeUserSafely(list[index], item);
      } else if (collection === 'branches') {
        list[index] = mergeBranchSafely(list[index], item);
      } else {
        list[index] = { ...list[index], ...item, updatedAt: new Date().toISOString() };
      }
    } else if (item) {
      list.push({ ...item, createdAt: item.createdAt || new Date().toISOString() });
    }
  }

  persistDatabaseToFile();
  invalidatePostgresCache();

  // Save to PostgreSQL if active
  if (isPostgresActive()) {
    const targetEntity = (collection === 'parcels' || collection === 'customers' || collection === 'users' || collection === 'branches') 
      ? (list.find((x) => x.id === item?.id || x.trackingNumber === item?.trackingNumber || x.code === item?.code || x.username === item?.username) || item) 
      : item;
    const ok = await saveItemToPostgres(collection, targetEntity, action || 'upsert', itemId);
    if (!ok) {
      console.warn(`[Sync] saveItemToPostgres returned false for ${collection}/${itemId}`);
      return res.status(500).json({
        success: false,
        error: 'فشل الحفظ في PostgreSQL',
        storage: 'PostgreSQL_failed',
      });
    }
  }

  // Broadcast single item mutation event to all active SSE subscribers for < 300ms instant sync
  const targetUpdatedItem = (collection === 'parcels' || collection === 'customers' || collection === 'users' || collection === 'branches')
    ? (list.find((x) => x.id === item?.id || x.trackingNumber === item?.trackingNumber || x.code === item?.code || x.username === item?.username) || item) 
    : item;
  broadcastServerEvent('item_mutation', {
    collection,
    item: targetUpdatedItem,
    action: action || 'upsert',
    itemId: itemId || item?.id || item?.trackingNumber || item?.manifestNumber,
  });

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    collection,
    action: action || 'upsert',
    storage: isPostgresActive() ? 'PostgreSQL' : 'FileFallback',
  });
});

// 9. Batch Delta Sync (Sync offline queue in one shot)
app.post('/api/sync/batch', async (req: Request, res: Response) => {
  const { queue } = req.body;

  if (!Array.isArray(queue)) {
    return res.status(400).json({ success: false, error: 'قائمة العمليات غير صالحة' });
  }

  const hasCriticalCollection = Array.isArray(queue) && 
    queue.some((op: any) => CRITICAL_COLLECTIONS.has(op?.collection));

  if (hasCriticalCollection && !isPostgresActive()) {
    console.error(
      `[Sync Batch] ⚠️ REJECTED critical batch: PostgreSQL is not connected.`
    );
    return res.status(503).json({
      success: false,
      error: 'قاعدة بيانات PostgreSQL غير متصلة. تم رفض الدفعة الحرجة لمنع فقدان البيانات.',
      storage: 'PostgreSQL_required',
    });
  }

  let processed = 0;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  for (const op of queue) {
    const { collection, item, action, itemId } = op;
    if (!collection || typeof collection !== 'string' || !ALLOWED_COLLECTIONS.has(collection)) continue;

    if (!Array.isArray(memoryDatabase[collection])) {
      memoryDatabase[collection] = [];
    }

    const list = memoryDatabase[collection] as any[];
    if (action === 'delete') {
      const targetId = itemId || item?.id;
      memoryDatabase[collection] = list.filter(
        (x) =>
          x.id !== targetId &&
          (!itemId || x.trackingNumber !== itemId) &&
          (!itemId || x.manifestNumber !== itemId) &&
          (!itemId || x.username !== itemId) &&
          (!itemId || x.code !== itemId) &&
          (!itemId || x.voucherNumber !== itemId)
      );
    } else if (item && (item.id || item.trackingNumber || item.manifestNumber || item.username || item.code || item.plateNumber || item.nationalId || collection === 'brandingSettings' || collection === 'codSettings')) {
      const stampedItem = {
        ...item,
        updatedAt: nowIso,
        createdAt: item.createdAt || nowIso,
        _serverUpdatedAtMs: nowMs,
      };

      if (collection === 'brandingSettings') {
        memoryDatabase.brandingSettings = [stampedItem];
      } else if (collection === 'codSettings') {
        memoryDatabase.codSettings = [stampedItem];
      } else {
        const itemNormPhone = normalizePhoneForComparison(item?.phone || item?.secondaryPhone);
        const itemNormName = normalizeArabicComparison(item?.fullName);
        const itemNid = item?.nationalId ? String(item.nationalId).replace(/\D/g, '') : '';

        const index = list.findIndex((x) => {
          if (item.id && x.id === item.id) return true;
          if (collection === 'vehicles' && item?.plateNumber && x.plateNumber && item.plateNumber.trim() === x.plateNumber.trim()) return true;
          if (collection === 'employees' && item?.nationalId && x.nationalId && item.nationalId.trim() === x.nationalId.trim()) return true;

          if (collection === 'customers') {
            const xNid = x.nationalId ? String(x.nationalId).replace(/\D/g, '') : '';
            if (itemNid.length >= 7 && xNid.length >= 7 && itemNid === xNid) return true;

            const xNormPhone = normalizePhoneForComparison(x.phone || x.secondaryPhone);
            if (itemNormPhone.length >= 6 && xNormPhone.length >= 6 && itemNormPhone === xNormPhone) return true;

            const xNormName = normalizeArabicComparison(x.fullName);
            if (itemNormName.length >= 3 && xNormName.length >= 3 && itemNormName === xNormName) {
              if (itemNormPhone && xNormPhone && itemNormPhone !== xNormPhone) return false;
              return true;
            }
            return false;
          }

          return (
            (collection === 'users' && item?.username && x.username && item.username.trim().toLowerCase() === x.username.trim().toLowerCase()) ||
            (collection === 'branches' && item?.code && x.code && item.code.trim().toUpperCase() === x.code.trim().toUpperCase()) ||
            (collection === 'vouchers' && item?.voucherNumber && x.voucherNumber === item.voucherNumber) ||
            (item.trackingNumber && x.trackingNumber && x.trackingNumber.trim().toUpperCase() === item.trackingNumber.trim().toUpperCase()) ||
            (item.manifestNumber && x.manifestNumber === item.manifestNumber)
          );
        });
        if (index >= 0) {
          if (collection === 'parcels') {
            const merged = mergeParcelSafely(list[index], stampedItem);
            merged.updatedAt = nowIso;
            merged._serverUpdatedAtMs = nowMs;
            list[index] = merged;
            op.item = merged;
          } else if (collection === 'customers') {
            const merged = mergeCustomerSafely(list[index], stampedItem);
            merged.updatedAt = nowIso;
            merged._serverUpdatedAtMs = nowMs;
            list[index] = merged;
            op.item = merged;
          } else if (collection === 'users') {
            const merged = mergeUserSafely(list[index], stampedItem);
            merged.updatedAt = nowIso;
            merged._serverUpdatedAtMs = nowMs;
            list[index] = merged;
            op.item = merged;
          } else if (collection === 'branches') {
            const merged = mergeBranchSafely(list[index], stampedItem);
            merged.updatedAt = nowIso;
            merged._serverUpdatedAtMs = nowMs;
            list[index] = merged;
            op.item = merged;
          } else {
            list[index] = { ...list[index], ...stampedItem };
          }
        } else {
          list.push(stampedItem);
        }
      }
    }
    processed++;
  }

  persistDatabaseToFile();
  invalidatePostgresCache();

  // Batch save to PostgreSQL inside transaction
  if (isPostgresActive()) {
    try {
      await batchSaveToPostgres(queue);
    } catch (err: any) {
      console.error('[PostgreSQL] Batch save transaction failed:', err);
      return res.status(500).json({
        success: false,
        error: 'فشل حفظ الدفعة في PostgreSQL',
        details: err?.message,
      });
    }
  }

  // Build operations array with resolved items
  const batchOperations = queue
    .filter((op: any) => op && op.collection)
    .map((op: any) => {
      if (op.action === 'delete') {
        return {
          collection: op.collection,
          item: null,
          action: 'delete',
          itemId: op.itemId || op.item?.id,
        };
      }
      const targetItem = op.collection === 'parcels'
        ? (memoryDatabase.parcels?.find((p: any) => 
            p.id === op.item?.id || 
            p.trackingNumber === op.item?.trackingNumber) || op.item)
        : op.collection === 'truckManifests'
        ? (memoryDatabase.truckManifests?.find((m: any) => 
            m.id === op.item?.id || 
            m.manifestNumber === op.item?.manifestNumber) || op.item)
        : op.item;
      
      return {
        collection: op.collection,
        item: targetItem,
        action: op.action || 'upsert',
        itemId: op.itemId || op.item?.id || 
                op.item?.trackingNumber || op.item?.manifestNumber,
      };
    });

  // ✅ Single batch_mutation event (replaces 30 individual item_mutation)
  broadcastServerEvent('batch_mutation', {
    batchId: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    operations: batchOperations,
    processed,
    timestamp: nowIso,
  });

  res.json({
    success: true,
    processed,
    timestamp: new Date().toISOString(),
    storage: isPostgresActive() ? 'PostgreSQL' : 'FileFallback',
    message: `تمت معالجة ومزامنة ${processed} عملية على السيرفر بنجاح.`,
  });
});

// 10. Direct Specific Endpoints
app.get('/api/parcels', (req: Request, res: Response) => {
  res.json(memoryDatabase.parcels || []);
});

app.get('/api/parcels/:parcelId/timeline', async (req: Request, res: Response) => {
  if (!isPostgresActive()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  const { parcelId } = req.params;
  const isPublic = req.query.public === '1';

  try {
    const result = await queryWithRetry(async (pool) =>
      pool.query(
        `SELECT * FROM v_parcel_timeline WHERE parcel_id = $1 OR tracking_number = $1`,
        [parcelId]
      )
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    const row = result.rows[0];

    // Public-safe mode: strip sensitive fields
    if (isPublic) {
      const safeEvents = (Array.isArray(row.events) ? row.events : [])
        .map((e: any) => ({
          id: e.id,
          eventType: e.eventType,
          dimension: e.dimension,
          newStatus: e.newStatus,
          timestamp: e.serverTimestamp,
        }));

      return res.json({
        trackingNumber: row.tracking_number,
        currentStatus: row.current_status,
        originHubId: row.origin_hub_id,
        destinationHubId: row.destination_hub_id,
        currentLocationBranchId: row.current_location_branch_id,
        events: safeEvents,
        eventsCount: row.events_count,
        firstEventAt: row.first_event_at,
        lastEventAt: row.last_event_at,
        transitDurationMs: row.transit_duration_ms,
      });
    }

    // Full mode (for staff)
    return res.json({
      parcelId: row.parcel_id,
      trackingNumber: row.tracking_number,
      currentStatus: row.current_status,
      codStatus: row.cod_status,
      shortageStatus: row.shortage_status,
      originHubId: row.origin_hub_id,
      destinationHubId: row.destination_hub_id,
      currentLocationBranchId: row.current_location_branch_id,
      events: row.events,
      eventsCount: row.events_count,
      firstEventAt: row.first_event_at,
      lastEventAt: row.last_event_at,
      transitDurationMs: row.transit_duration_ms,
    });
  } catch (err: any) {
    console.error('[Timeline API] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/branches', (req: Request, res: Response) => {
  res.json(memoryDatabase.branches || []);
});

app.get('/api/manifests', (req: Request, res: Response) => {
  res.json(memoryDatabase.truckManifests || []);
});

// 11. Backup Export / Download JSON from VPS
app.get('/api/backup/export', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orca-vps-backup-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.send(JSON.stringify(memoryDatabase, null, 2));
});

// ==========================================
// Startup & Vite Integration
// ==========================================
async function startServer() {
  // Try initializing PostgreSQL
  const pgConnected = await initPostgres();
  if (pgConnected) {
    const pgData = await pullAllFromPostgres();
    const hasData = pgData && Object.keys(pgData).length > 0;
    if (hasData) {
      memoryDatabase = { ...memoryDatabase, ...pgData };
      console.log('[PostgreSQL] Initialized memory cache with live PostgreSQL data.');
    } else {
      // 🛑 AUTO-SEED IS STRICTLY DISABLED
      memoryDatabase = {};
      console.warn('[PostgreSQL] ⚠️ Database is EMPTY. Auto-seed is STRICTLY DISABLED for safety.');
      console.log('[PostgreSQL] System is ready for first-time clean setup via /api/bootstrap/init.');
    }

    // Apply schema_v2 (idempotent)
    try {
      const result = await applySchemaV2();
      if (result.applied) {
        console.log('[Schema v2] Applied on this startup.');
      } else if (result.error) {
        console.warn('[Schema v2] Not applied:', result.error);
      }
    } catch (err) {
      console.warn('[Schema v2] Non-fatal error:', err);
    }

    // Run obligations backfill (idempotent & non-blocking)
    try {
      const backfillResult = await backfillObligationsOnce(false);
      if (backfillResult.executed) {
        console.log(`[Obligations] Backfill completed: inserted ${backfillResult.inserted}, skipped ${backfillResult.skipped}`);
        console.log(`[Obligations] Stats:`, backfillResult.stats);
      } else {
        console.log(`[Obligations] Backfill already done previously (flag present in orca_meta).`);
      }
    } catch (err) {
      console.error('[Obligations] Backfill non-fatal error:', err);
    }

    // Run parcel events migration (idempotent & non-blocking)
    try {
      const migrateResult = await migrateParcelEventsOnce(false);
      if (migrateResult.executed) {
        console.log(`[Parcel Events] Migration: inserted ${migrateResult.inserted}, skipped ${migrateResult.skipped}`);
      } else {
        console.log(`[Parcel Events] Migration already done.`);
      }
    } catch (err) {
      console.error('[Parcel Events] Migration failed (non-fatal):', err);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/vps-data/**',
            '**/vps-data/*',
            '**/*.log',
            '**/orca-database.json',
            '**/.git/**',
            '**/node_modules/**',
            '**/dist/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Orca Express Logistics] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
