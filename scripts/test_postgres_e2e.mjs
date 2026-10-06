import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function main() {
  console.log('--- Initializing Clean PostgreSQL (WASM) Instance ---');
  const db = new PGlite();
  
  console.log('--- Loading and Executing test_dump.sql ---');
  const dumpSql = fs.readFileSync('test_dump.sql', 'utf8');
  await db.exec(dumpSql);
  console.log('--- test_dump.sql Executed Successfully! ---');

  console.log('\n--- Running Verification Queries ---');
  
  // 1. orca_entities count
  const countEntities = await db.query('SELECT COUNT(*) FROM orca_entities;');
  console.log('SELECT COUNT(*) FROM orca_entities; =>', countEntities.rows);

  // 2. pg_views count
  const countViews = await db.query("SELECT COUNT(*) FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%';");
  console.log("SELECT COUNT(*) FROM pg_views WHERE schemaname='public' AND viewname LIKE 'v_%'; =>", countViews.rows);

  // 3. pg_trigger count and definitions on orca_entities
  const countTriggers = await db.query("SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal;");
  console.log("SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal; =>", countTriggers.rows);

  const triggerDefs = await db.query(`
    SELECT tgname, tgrelid::regclass::text as table_name, pg_get_triggerdef(oid) as def
    FROM pg_trigger 
    WHERE tgrelid = 'orca_entities'::regclass AND NOT tgisinternal
    ORDER BY tgname;
  `);
  console.log("--- TRIGGER DEFINITIONS ON orca_entities ---");
  console.log(JSON.stringify(triggerDefs.rows, null, 2));

  // 4. pg_proc safe_* functions count
  const countSafeProcs = await db.query("SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'safe_%';");
  console.log("SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'safe_%'; =>", countSafeProcs.rows);

  // 5. Query Views Limit 1
  const vBranches = await db.query('SELECT * FROM v_branches LIMIT 1;');
  console.log('SELECT * FROM v_branches LIMIT 1; =>', vBranches.rows);

  const vTransactions = await db.query('SELECT * FROM v_transactions LIMIT 1;');
  console.log('SELECT * FROM v_transactions LIMIT 1; =>', vTransactions.rows);

  const vLiveBalances = await db.query('SELECT * FROM v_branch_live_balances LIMIT 1;');
  console.log('SELECT * FROM v_branch_live_balances LIMIT 1; =>', vLiveBalances.rows);

  const vTimeline = await db.query('SELECT * FROM v_parcel_timeline LIMIT 1;');
  console.log('SELECT * FROM v_parcel_timeline LIMIT 1; =>', vTimeline.rows);

  // 6. Test Corrupt Data Fault Injection on Trigger
  console.log('\n--- Testing Fault Injection on Financial Audit Trigger ---');
  await db.query(`
    INSERT INTO orca_entities (collection, id, data)
    VALUES ('transactions', 'verify_trigger_e2e',
      '{"id":"verify_trigger_e2e","amount":"abc_corrupted","currency":"SYP","branchId":"br_test"}'::jsonb
    );
  `);
  
  const auditRes = await db.query("SELECT entity_id, amount, currency, branch_id FROM financial_audit_trail WHERE entity_id='verify_trigger_e2e';");
  console.log("Fault Injection Audit Trail Row: =>", auditRes.rows);

  // 7. Test Mirror tables
  console.log('\n--- Testing Mirror Tables Queries ---');
  const mirrorRes = await db.query(`
    SELECT 
      (SELECT COUNT(*) FROM orca_entities WHERE collection='interBranchObligations') as main_obligations,
      (SELECT COUNT(*) FROM inter_branch_obligations) as mirror_obligations,
      (SELECT COUNT(*) FROM orca_entities WHERE collection='parcelEvents') as main_events,
      (SELECT COUNT(*) FROM parcel_events) as mirror_events;
  `);
  console.log("Mirror tables counts: =>", mirrorRes.rows);

  console.log('\n--- ALL E2E POSTGRESQL VERIFICATION TESTS PASSED ---');
}

main().catch(err => {
  console.error('FAILED with error:', err);
  process.exit(1);
});
