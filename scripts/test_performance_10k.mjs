import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function main() {
  console.log('=== TEST 5: PERFORMANCE UNDER LOAD (10,000 ROWS) ===');
  const db = new PGlite();
  
  // 1. Load schema
  const dumpSql = fs.readFileSync('test_dump.sql', 'utf8');
  await db.exec(dumpSql);
  console.log('Database schema loaded.');

  // Disable triggers temporarily during bulk population for fast batch insertion, or keep enabled
  console.log('Populating 10,000 rows (5,000 parcels, 3,000 transactions, 2,000 customers)...');
  const loadStart = Date.now();

  // Batch insert parcels (5,000)
  await db.exec(`
    INSERT INTO orca_entities (collection, id, data, updated_at)
    SELECT 
      'parcels',
      'prc_load_' || i,
      jsonb_build_object(
        'id', 'prc_load_' || i,
        'trackingNumber', 'TRK' || LPAD(i::text, 8, '0'),
        'senderName', 'Sender ' || i,
        'recipientName', 'Recipient ' || i,
        'originHubId', 'br_1',
        'destinationHubId', 'br_2',
        'handlingStatus', CASE WHEN i % 3 = 0 THEN 'delivered' WHEN i % 3 = 1 THEN 'in_transit' ELSE 'received_at_hub' END,
        'status', 'in_progress',
        'codAmount', (i * 10)::text,
        'shippingCost', '1500',
        'currency', 'SYP'
      ),
      NOW() - ((10000 - i) || ' seconds')::interval
    FROM generate_series(1, 5000) s(i);
  `);
  console.log('5,000 parcels inserted.');

  // Batch insert transactions (3,000)
  await db.exec(`
    INSERT INTO orca_entities (collection, id, data, updated_at)
    SELECT 
      'transactions',
      'tx_load_' || i,
      jsonb_build_object(
        'id', 'tx_load_' || i,
        'amount', (i * 50)::text,
        'currency', 'SYP',
        'branchId', 'br_1',
        'type', CASE WHEN i % 2 = 0 THEN 'receipt' ELSE 'payment' END,
        'cashboxScope', 'master'
      ),
      NOW() - ((10000 - i) || ' seconds')::interval
    FROM generate_series(1, 3000) s(i);
  `);
  console.log('3,000 transactions inserted.');

  // Batch insert customers (2,000)
  await db.exec(`
    INSERT INTO orca_entities (collection, id, data, updated_at)
    SELECT 
      'customers',
      'cst_load_' || i,
      jsonb_build_object(
        'id', 'cst_load_' || i,
        'code', 'CST' || i,
        'fullName', 'Customer ' || i,
        'phone', '09' || LPAD(i::text, 8, '0'),
        'totalShipmentsSent', (i % 20)::text
      ),
      NOW() - ((10000 - i) || ' seconds')::interval
    FROM generate_series(1, 2000) s(i);
  `);
  console.log('2,000 customers inserted.');

  // Also insert/update test branches for live balances
  await db.exec(`
    INSERT INTO orca_entities (collection, id, data, updated_at)
    VALUES 
      ('branches', 'br_1', '{"id":"br_1","code":"DAM","name":"Damascus HQ"}'::jsonb, NOW()),
      ('branches', 'br_2', '{"id":"br_2","code":"ALP","name":"Aleppo Hub"}'::jsonb, NOW())
    ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data;
  `);

  console.log(`Population completed in ${Date.now() - loadStart} ms.`);
  
  // Verify counts
  const totalCount = await db.query('SELECT COUNT(*) as c FROM orca_entities;');
  console.log('Total orca_entities count:', totalCount.rows[0].c);

  // 2. Query 1: SELECT * FROM orca_entities WHERE collection='parcels' LIMIT 100;
  console.log('\n--- EXPLAIN ANALYZE 1: orca_entities parcels LIMIT 100 ---');
  const t1 = Date.now();
  const q1Res = await db.query("SELECT * FROM orca_entities WHERE collection='parcels' LIMIT 100;");
  const d1 = Date.now() - t1;
  const exp1 = await db.query("EXPLAIN ANALYZE SELECT * FROM orca_entities WHERE collection='parcels' LIMIT 100;");
  console.log(`Query 1 Latency: ${d1} ms (${q1Res.rows.length} rows)`);
  console.log(exp1.rows.map(r => r['QUERY PLAN']).join('\n'));

  // 3. Query 2: SELECT * FROM v_parcels LIMIT 100;
  console.log('\n--- EXPLAIN ANALYZE 2: v_parcels LIMIT 100 ---');
  const t2 = Date.now();
  const q2Res = await db.query("SELECT * FROM v_parcels LIMIT 100;");
  const d2 = Date.now() - t2;
  const exp2 = await db.query("EXPLAIN ANALYZE SELECT * FROM v_parcels LIMIT 100;");
  console.log(`Query 2 Latency: ${d2} ms (${q2Res.rows.length} rows)`);
  console.log(exp2.rows.map(r => r['QUERY PLAN']).join('\n'));

  // 4. Query 3: SELECT * FROM v_branch_live_balances;
  console.log('\n--- EXPLAIN ANALYZE 3: v_branch_live_balances (full) ---');
  const t3 = Date.now();
  const q3Res = await db.query("SELECT * FROM v_branch_live_balances;");
  const d3 = Date.now() - t3;
  const exp3 = await db.query("EXPLAIN ANALYZE SELECT * FROM v_branch_live_balances;");
  console.log(`Query 3 Latency: ${d3} ms (${q3Res.rows.length} rows)`);
  console.log(exp3.rows.map(r => r['QUERY PLAN']).join('\n'));

  // 5. Query 4: Delta sync pagination query
  console.log('\n--- EXPLAIN ANALYZE 4: Delta Sync Watermark Pagination ---');
  const t4 = Date.now();
  const q4Res = await db.query(`
    SELECT collection, id, data, updated_at 
    FROM orca_entities 
    WHERE (updated_at > '2020-01-01T00:00:00Z'::timestamptz) 
    ORDER BY updated_at ASC, id ASC 
    LIMIT 500;
  `);
  const d4 = Date.now() - t4;
  const exp4 = await db.query(`
    EXPLAIN ANALYZE 
    SELECT collection, id, data, updated_at 
    FROM orca_entities 
    WHERE (updated_at > '2020-01-01T00:00:00Z'::timestamptz) 
    ORDER BY updated_at ASC, id ASC 
    LIMIT 500;
  `);
  console.log(`Query 4 Latency: ${d4} ms (${q4Res.rows.length} rows)`);
  console.log(exp4.rows.map(r => r['QUERY PLAN']).join('\n'));
}

main().catch(err => {
  console.error('Test 5 error:', err);
  process.exit(1);
});
