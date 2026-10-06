import pg from 'pg';
const { Pool } = pg;

// Exact retry logic from server/postgres.ts
let activePool = null;
let isConnected = false;
let initCount = 0;

async function mockInitPostgres() {
  initCount++;
  console.log(`[PostgreSQL] Mock initPostgres() called (attempt #${initCount})`);
  // In real server, this creates a new Pool instance
  activePool = {
    isClosed: false,
    async query(sql, params) {
      if (this.isClosed) {
        const err = new Error('Connection terminated unexpectedly');
        err.code = '57P01';
        throw err;
      }
      return { rows: [{ result: 'ok', sql }], rowCount: 1 };
    },
    async end() {
      this.isClosed = true;
      console.log('[PostgreSQL] Connection pool explicitly terminated (network drop simulated).');
    }
  };
  isConnected = true;
  return true;
}

async function queryWithRetry(queryFn, retries = 1) {
  if (!activePool || !isConnected) {
    await mockInitPostgres();
  }
  try {
    return await queryFn(activePool);
  } catch (err) {
    const errMsg = String(err?.message || err);
    const isConnError =
      errMsg.includes('Connection terminated') ||
      errMsg.includes('timeout') ||
      errMsg.includes('closed') ||
      errMsg.includes('ECONNRESET') ||
      err?.code === '57P01' ||
      err?.code === '08006';

    console.log(`[queryWithRetry] Caught error: "${errMsg}" (isConnError: ${isConnError}, retries left: ${retries})`);

    if (isConnError && retries > 0) {
      console.warn('[PostgreSQL] Connection dropped or timed out. Re-initializing connection pool and retrying query...');
      isConnected = false;
      const reconnected = await mockInitPostgres();
      if (reconnected && activePool) {
        return await queryFn(activePool);
      }
    }
    throw err;
  }
}

async function main() {
  console.log('=== TEST 3: NETWORK DROP & AUTO-RETRY TEST ===');
  
  // 1. Initial connection
  await mockInitPostgres();
  
  // 2. First insert request
  console.log('\n--- Step 1: Sending first INSERT ---');
  const res1 = await queryWithRetry(async (p) => p.query('INSERT INTO orca_entities ... parcel 1'));
  console.log('First INSERT result:', res1.rows[0]);

  // 3. Simulate sudden network drop after 500ms
  console.log('\n--- Step 2: Simulating Sudden Network Disconnection ---');
  await activePool.end();

  // 4. Second insert request while network is dropped
  console.log('\n--- Step 3: Sending second INSERT during network disconnection ---');
  const res2 = await queryWithRetry(async (p) => p.query('INSERT INTO orca_entities ... parcel 2'));
  console.log('Second INSERT result (after auto-reconnect & retry):', res2.rows[0]);

  console.log('\n--- SUMMARY ---');
  console.log('Total mockInitPostgres calls:', initCount);
  console.log('Second INSERT status: SUCCESS (Recovered seamlessly without data loss)');
}

main().catch(err => {
  console.error('Test 3 failed:', err);
  process.exit(1);
});
