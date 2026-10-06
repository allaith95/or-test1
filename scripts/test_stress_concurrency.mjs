import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function main() {
  console.log('=== TEST 2: CONCURRENT WRITES STRESS TEST ===');
  const db = new PGlite();
  
  // Load DDL
  const dumpSql = fs.readFileSync('test_dump.sql', 'utf8');
  await db.exec(dumpSql);
  console.log('Schema loaded.');

  const CONCURRENCY = 10;
  const INSERTS_PER_WORKER = 100;
  const TOTAL_EXPECTED = CONCURRENCY * INSERTS_PER_WORKER;

  console.log(`Starting ${CONCURRENCY} concurrent workers, each performing ${INSERTS_PER_WORKER} inserts (${TOTAL_EXPECTED} total)...`);
  
  const startTime = Date.now();
  let firstQueryTime = null;
  let lastQueryTime = null;
  let errorCount = 0;
  const errors = [];

  const workers = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    for (let i = 0; i < INSERTS_PER_WORKER; i++) {
      const qStart = Date.now();
      const txId = `tx_worker_${workerId}_seq_${i}_${Date.now()}`;
      const payload = JSON.stringify({
        id: txId,
        amount: String((workerId + 1) * 100 + i),
        currency: 'SYP',
        type: 'receipt',
        branchId: `br_branch_${workerId % 3}`,
        description: `Concurrent stress insert by worker ${workerId} item ${i}`,
        createdAt: new Date().toISOString()
      });

      try {
        await db.query(`
          INSERT INTO orca_entities (collection, id, data, updated_at)
          VALUES ('transactions', $1, $2::jsonb, NOW())
          ON CONFLICT (collection, id) DO UPDATE 
          SET data = EXCLUDED.data, updated_at = NOW();
        `, [txId, payload]);

        const duration = Date.now() - qStart;
        if (firstQueryTime === null) firstQueryTime = duration;
        lastQueryTime = duration;
      } catch (err) {
        errorCount++;
        errors.push(`Worker ${workerId} Item ${i}: ${err.message}`);
      }
    }
  });

  await Promise.all(workers);
  const totalElapsedMs = Date.now() - startTime;

  // Verify actual row count in orca_entities
  const countRes = await db.query("SELECT COUNT(*) as count FROM orca_entities WHERE collection = 'transactions';");
  const actualCount = Number(countRes.rows[0].count);

  // Verify financial_audit_trail count
  const auditCountRes = await db.query("SELECT COUNT(*) as count FROM financial_audit_trail WHERE entity_collection = 'transactions';");
  const auditCount = Number(auditCountRes.rows[0].count);

  console.log('\n--- CONCURRENT STRESS TEST RESULTS ---');
  console.log(`Total Expected Inserts: ${TOTAL_EXPECTED}`);
  console.log(`Actual orca_entities Rows: ${actualCount}`);
  console.log(`Audit Trail Logged Rows: ${auditCount}`);
  console.log(`Total Exceptions / Errors: ${errorCount}`);
  console.log(`Total Time Elapsed: ${totalElapsedMs} ms`);
  console.log(`Throughput: ${(actualCount / (totalElapsedMs / 1000)).toFixed(2)} ops/sec`);
  console.log(`First Query Latency: ${firstQueryTime} ms`);
  console.log(`Last Query Latency: ${lastQueryTime} ms`);
  if (errors.length > 0) {
    console.log('Errors sample:', errors.slice(0, 5));
  }
}

main().catch(err => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
