#!/usr/bin/env node
/**
 * Orca Express - Clean Production Bootstrap CLI Utility
 * 
 * Usage:
 *   node scripts/bootstrap_admin.mjs \
 *     --admin-name "سليمان الأحمد" \
 *     --username "سليمان" \
 *     --password "111222000" \
 *     --branch-name "المركز اللوجستي الرئيسي - دمشق" \
 *     --branch-code "DAM-01" \
 *     --branch-city "دمشق" \
 *     --bootstrap-key "orca_bootstrap_secure_key_2026_production_safe"
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        params[key] = next;
        i++;
      } else {
        params[key] = true;
      }
    }
  }
  return params;
}

async function runBootstrap() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌊 ORCA EXPRESS LOGISTICS - PRODUCTION BOOTSTRAP CLI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const args = parseArgs();
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database.');

    // 1. Check if already bootstrapped
    const countRes = await client.query(
      `SELECT COUNT(*)::int as count FROM orca_entities WHERE collection = 'users'`
    );
    const existingCount = countRes.rows[0]?.count || 0;

    if (existingCount > 0) {
      console.warn(`⚠️ System is already bootstrapped with ${existingCount} active user(s).`);
      console.warn('🛑 Aborting bootstrap operation to prevent overwriting existing accounts.');
      client.release();
      await pool.end();
      process.exit(0);
    }

    const adminName = args['admin-name'] || 'سليمان';
    const username = args['username'] || 'سليمان';
    const password = args['password'] || '111222000';
    const branchName = args['branch-name'] || 'المركز اللوجستي الرئيسي - دمشق';
    const branchCode = (args['branch-code'] || 'DAM-MAIN').toUpperCase();
    const branchCity = args['branch-city'] || 'دمشق';
    const phone = args['phone'] || '';

    const now = new Date().toISOString();
    const branchId = `br_${branchCode.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
    const userId = `usr_${username.toLowerCase().trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') || 'admin'}`;

    const initialBranch = {
      id: branchId,
      code: branchCode,
      name: branchName,
      type: 'main_hub',
      governorate: branchCity,
      commissionRateShipping: 10,
      commissionRateTransfers: 1,
      boxSypBalance: 0,
      boxUsdBalance: 0,
      address: 'المركز اللوجستي الرئيسي',
      phone: phone,
      managerName: adminName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const initialAdmin = {
      id: userId,
      name: adminName,
      username: username,
      password: password,
      role: 'super_admin',
      branchId: '',
      canSwitchBranches: true,
      allowedBranchIds: [branchId],
      phone: phone,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await client.query('BEGIN');

    // Insert Initial Branch
    await client.query(
      `INSERT INTO orca_entities (collection, id, data, updated_at)
       VALUES ('branches', $1, $2, NOW())
       ON CONFLICT (collection, id) DO NOTHING`,
      [branchId, JSON.stringify(initialBranch)]
    );

    // Insert Super Admin User
    await client.query(
      `INSERT INTO orca_entities (collection, id, data, updated_at)
       VALUES ('users', $1, $2, NOW())
       ON CONFLICT (collection, id) DO NOTHING`,
      [userId, JSON.stringify(initialAdmin)]
    );

    // Insert Audit Log
    await client.query(
      `INSERT INTO orca_audit_logs (action, collection, entity_id, user_name, payload)
       VALUES ('BOOTSTRAP_INITIALIZE', 'system', $1, $2, $3)`,
      [userId, adminName, JSON.stringify({ branch: initialBranch, user: initialAdmin })]
    );

    await client.query('COMMIT');
    client.release();
    await pool.end();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 BOOTSTRAP INITIALIZATION COMPLETED SUCCESSFULLY!');
    console.log(`🏢 First Branch: ${initialBranch.name} (${initialBranch.code})`);
    console.log(`👤 Super Admin:  ${initialAdmin.name} (@${initialAdmin.username})`);
    console.log('🔒 Bootstrap gate is now permanently locked.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ Bootstrap failure:', err);
    process.exit(1);
  }
}

runBootstrap();
