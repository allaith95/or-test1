# INCIDENT-001: Automatic Seed & Cache Injection Following Database Recreation

- **Incident Reference:** INCIDENT-001
- **Date:** 2026-10-04
- **Severity:** P0 (Operational Blocker)
- **Component:** Core Backend Sync, VPS File Cache & Client State Engine
- **Status:** Resolved & Permanently Hardened

---

## 1. Executive Summary

During testing in a staging/production deployment, the operations team deleted the test PostgreSQL database and provisioned a new, empty database. Upon launching the application, branches, staff members, and couriers were unexpectedly imported into the system automatically without explicit user command or authorization. 

This automatic injection resulted in branch identifier mismatches where staff accounts were detached from their associated branches, halting operational workflows.

An emergency forensic investigation was launched, identifying **6 root causes** spanning server startup logic, fallback file restore mechanisms, offline sync queues, client union merging, legacy storage key migrations, and client-side default constants.

---

## 2. The 6 Root Causes

### 🔴 Cause 1: Auto-Seed on Empty Database in `server.ts` (`startServer()`)
* **Mechanism:** Upon server initialization, `startServer()` connected to PostgreSQL and executed `pullAllFromPostgres()`. If the result was empty, the server evaluated `pushAllToPostgres(memoryDatabase)`, immediately writing in-memory cached entities into the new, clean database.

### 🔴 Cause 2: Auto-Restore from `.bak` Files in `loadDatabaseFromFile()`
* **Mechanism:** `loadDatabaseFromFile()` checked for the existence of `/vps-data/orca-database.json` and `/vps-data/orca-database.json.bak`. If the main file was missing or empty, it automatically revived records from the backup file, populating `memoryDatabase`.

### 🔴 Cause 3: Unconditional Offline Queue Auto-Flush in `vpsSyncEngine.ts`
* **Mechanism:** When the client initialized or regained network connectivity, `processOfflineQueue()` immediately flushed pending mutations to `/api/sync/batch` without verifying whether the target server was a newly provisioned empty instance.

### 🔴 Cause 4: Union Merging in `OrcaContext.tsx`
* **Mechanism:** `handleRemoteBranches` and `handleRemoteUsers` in `OrcaContext` performed a `Union Merge` (`[...validRemotes, ...localOnlyBranches]`). When the server returned branches with differing IDs, local entities persisted alongside them instead of allowing the server to act as the authoritative single source of truth.

### 🔴 Cause 5: Automatic `localStorage` Key Migration in `main.tsx`
* **Mechanism:** A self-invoking function (`migrateStorageKeys`) in `main.tsx` merged legacy `orca_logistics_v4_*` keys into `ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5_*`, resurrecting obsolete local testing entities into active memory.

### 🔴 Cause 6: Initial Hardcoded Data Constants (`initialData.ts`)
* **Mechanism:** Fallback defaults in `src/data/initialData.ts` contained hardcoded users (`INITIAL_USERS`), causing mock structures to be resurrected whenever local storage was empty.

---

## 3. Technical Hardening & Gap Closures

1. **Strict Auto-Seed Removal (`server.ts`):**
   - Removed `pushAllToPostgres` from `startServer()`.
   - Removed `loadDatabaseFromFile()` from `startServer()`.
   - When PostgreSQL is empty, `memoryDatabase` is set to `{}` and an explicit safety warning is logged:
     `[PostgreSQL] ⚠️ Database is EMPTY. Auto-seed is STRICTLY DISABLED for safety.`

2. **Clean Bootstrap Architecture (`/api/bootstrap/*`):**
   - `GET /api/bootstrap/status`: Verifies if any users exist in the database.
   - `POST /api/bootstrap/init`: Creates the first branch and super admin user with `BOOTSTRAP_KEY`.
   - **Permanent Lock:** Once at least 1 user exists, `/api/bootstrap/init` is permanently locked (HTTP 403).
   - CLI utility provided at `scripts/bootstrap_admin.mjs`.

3. **Secured Administrative Endpoints:**
   - Deleted unprotected `POST /api/db/seed-to-postgres`.
   - `POST /api/admin/seed` strictly requires `ADMIN_SEED_KEY` (secret, unlogged, never returned in responses) + `confirmText: "CONFIRM_MANUAL_SEED"`.

4. **Empty Database Safety Guard in `vpsSyncEngine.ts`:**
   - Added pre-flush database check (`/api/db/status`).
   - If `isDbEmpty === true` and `queue.length > 50`, automatic queue flushing is blocked to protect clean environments.

5. **Server-Authoritative Synchronization in `OrcaContext.tsx`:**
   - Removed Union Merge logic from `handleRemoteBranches` and `handleRemoteUsers`.
   - Server data is treated as the single authoritative source of truth.

6. **Deactivated Storage Key Migration in `main.tsx`:**
   - `migrateStorageKeys()` is permanently disabled with audit warnings.

7. **Sanitized Initial Constants (`initialData.ts`):**
   - `INITIAL_USERS = []` and `INITIAL_BRANCHES = []`.
   - `EMPTY_GUEST_USER` utilized for unauthenticated states.

---

## 4. Operational Recovery Guide for Affected Environments

For deployments currently experiencing data contamination:

1. **Stop Application Processes:**
   ```bash
   pm2 stop all
   ```

2. **Generate Database Snapshot:**
   ```bash
   pg_dump "$DATABASE_URL" > emergency_state_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Execute Clean Truncation (Zero-Wipe):**
   ```sql
   BEGIN;
   TRUNCATE TABLE orca_entities CASCADE;
   TRUNCATE TABLE orca_audit_logs CASCADE;
   TRUNCATE TABLE financial_audit_trail CASCADE;
   TRUNCATE TABLE branch_balance_snapshots CASCADE;
   TRUNCATE TABLE inter_branch_obligations CASCADE;
   TRUNCATE TABLE parcel_events CASCADE;
   TRUNCATE TABLE app_photos CASCADE;
   DELETE FROM sync_state WHERE key='last_sync';
   COMMIT;
   ```

4. **Purge Server Cache Files:**
   ```bash
   rm -f vps-data/orca-database.json vps-data/orca-database.json.bak vps-data/audit-sync.log
   ```

5. **Purge Client Browser Storage:**
   In browser Developer Tools Console:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
   ```

6. **Deploy Updated Code & Restart:**
   ```bash
   npm run build
   pm2 restart all
   ```

7. **Bootstrap First Admin:**
   Open `http://<your-server>:3000/bootstrap` in browser, enter `BOOTSTRAP_KEY` and define the initial branch and admin credentials.

---

## 5. Prevention & Governance Rules

> **Zero Auto-Write Mandate:** No entity shall be inserted, updated, or seeded into PostgreSQL without:
> 1. Explicit human user action.
> 2. Secondary confirmation (administrative credential or confirmation token).
> 3. An immutable entry recorded in `orca_audit_logs`.
