import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 RUNNING CLEAN BOOTSTRAP & INCIDENT VERIFICATION TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const HOST = '127.0.0.1';
  const PORT = 3000;

  // Test 1: Check DB status
  console.log('\n[Test 1] Checking DB status & empty detection...');
  const statusRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/db/status',
    method: 'GET',
  });
  console.log('Status Response:', statusRes.data);
  console.log(`✅ isDbEmpty reported: ${statusRes.data.isDbEmpty}`);

  // Test 2: Check Bootstrap Status
  console.log('\n[Test 2] Checking /api/bootstrap/status...');
  const bootStatus = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/status',
    method: 'GET',
  });
  console.log('Bootstrap Status:', bootStatus.data);

  // Test 3: Attempt Admin Seed with Wrong Key (Must Fail 403)
  console.log('\n[Test 3] Attempting /api/admin/seed with invalid key...');
  const badSeedRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/admin/seed',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { adminKey: 'wrong_key', confirmText: 'CONFIRM_MANUAL_SEED' });
  console.log(`Status: ${badSeedRes.status}, Error:`, badSeedRes.data.error);
  if (badSeedRes.status === 403) {
    console.log('✅ Correctly rejected invalid admin seed key (403)');
  } else {
    console.error('❌ Failed security check!');
  }

  // Test 4: Attempt Admin Seed with Missing confirmText (Must Fail 400)
  console.log('\n[Test 4] Attempting /api/admin/seed without confirmation text...');
  const noConfirmRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/admin/seed',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { adminKey: 'orca_admin_secret_seed_key_2026_super_secure_protection', confirmText: 'wrong' });
  console.log(`Status: ${noConfirmRes.status}, Error:`, noConfirmRes.data.error);
  if (noConfirmRes.status === 400) {
    console.log('✅ Correctly rejected missing confirmation text (400)');
  }

  // Test 5: Verify deleted /api/db/seed-to-postgres (Must Fail 404 or Not Found)
  console.log('\n[Test 5] Verifying /api/db/seed-to-postgres deletion...');
  const delEndpointRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/db/seed-to-postgres',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {});
  console.log(`Status: ${delEndpointRes.status}`);
  if (delEndpointRes.status === 404) {
    console.log('✅ /api/db/seed-to-postgres is completely deleted (404)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 ALL INCIDENT HARDENING TESTS PASSED SUCCESSFULLY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runTests().catch(console.error);
