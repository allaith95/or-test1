import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, rawData: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTING SIMPLE BOOTSTRAP (ZERO KEYS, STRICT DB PROTECTION)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Test 1: Check initial status
  console.log('\n[Test 1] Checking /api/bootstrap/status...');
  const statusRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap/status',
    method: 'GET',
  });
  console.log('Status code:', statusRes.status);
  console.log('Response:', statusRes.data);

  // Test 2: If DB is empty, run simple bootstrap
  if (statusRes.data?.canBootstrap) {
    console.log('\n[Test 2] Database is empty. Attempting POST /api/bootstrap/init (No keys, 5 fields)...');
    const initRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bootstrap/init',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      branchName: 'المركز اللوجستي - دمشق',
      branchCode: 'DAM-MAIN',
      branchGovernorate: 'دمشق',
      adminName: 'سليمان',
      password: 'testpassword123',
    });
    console.log('Status code:', initRes.status);
    console.log('Init result:', initRes.data);

    if (initRes.status === 200 && initRes.data?.success) {
      console.log('✅ Bootstrap succeeded without any secret keys!');
    } else {
      console.error('❌ Bootstrap failed unexpectedly:', initRes);
    }
  } else {
    console.log('\n[Notice] System is already bootstrapped (userCount > 0).');
  }

  // Test 3: Attempting POST /api/bootstrap/init again -> MUST BE REJECTED WITH 403
  console.log('\n[Test 3] Attempting POST /api/bootstrap/init when system already has users...');
  const lockedRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap/init',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    branchName: 'فرع متسلل',
    branchCode: 'HACK',
    branchGovernorate: 'حلب',
    adminName: 'متسلل',
    password: 'badpassword',
  });
  console.log('Status code:', lockedRes.status);
  console.log('Lock rejection message:', lockedRes.data);

  if (lockedRes.status === 403) {
    console.log('✅ PASS: Second bootstrap is strictly FORBIDDEN with 403!');
  } else {
    console.error('❌ FAIL: Expected 403 Forbidden for second bootstrap, got:', lockedRes.status);
  }

  // Test 4: Confirm /api/admin/seed is 404
  console.log('\n[Test 4] Verifying /api/admin/seed route is completely deleted (404)...');
  const seedRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/seed',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { test: true });
  console.log('Status code for /api/admin/seed:', seedRes.status);
  if (seedRes.status === 404) {
    console.log('✅ PASS: /api/admin/seed returned 404 Not Found as expected.');
  } else {
    console.error('❌ FAIL: /api/admin/seed still exists with status:', seedRes.status);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏁 ALL VERIFICATIONS COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

run().catch(console.error);
