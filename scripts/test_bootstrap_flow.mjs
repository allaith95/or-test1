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

async function runBootstrapTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 TESTING BOOTSTRAP INITIALIZATION FLOW & SECURITY LOCK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const HOST = '127.0.0.1';
  const PORT = 3000;

  // 1. Initial State
  const initialStatus = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/status',
    method: 'GET',
  });
  console.log('[Step 1] Initial Status:', initialStatus.data);

  // 2. Attempt Bootstrap with Invalid Key
  console.log('\n[Step 2] Attempting Bootstrap with wrong key...');
  const badKeyRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/init',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    bootstrapKey: 'wrong_key',
    adminName: 'سليمان',
    username: 'سليمان',
    password: '111222000',
    initialBranchName: 'فرع دمشق المركزي',
    initialBranchCode: 'DAM-01',
  });
  console.log(`Status: ${badKeyRes.status}, Error:`, badKeyRes.data.error);

  // 3. Execute Valid Bootstrap Initialization
  console.log('\n[Step 3] Executing valid Bootstrap Initialization...');
  const validBootRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/init',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    bootstrapKey: 'orca_bootstrap_secure_key_2026_production_safe',
    adminName: 'سليمان الأحمد',
    username: 'سليمان',
    password: '111222000',
    phone: '0999111222',
    initialBranchName: 'المركز الرئيسي - دمشق',
    initialBranchCode: 'DAM-MAIN',
    initialBranchCity: 'دمشق',
  });
  console.log(`Status: ${validBootRes.status}, Success: ${validBootRes.data.success}`);
  console.log('Created Branch:', validBootRes.data.branch);
  console.log('Created Admin User:', validBootRes.data.user);

  // 4. Check Status After Bootstrap
  console.log('\n[Step 4] Checking /api/bootstrap/status after initialization...');
  const postBootStatus = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/status',
    method: 'GET',
  });
  console.log('Post-Bootstrap Status:', postBootStatus.data);
  console.log(`✅ isBootstrapped: ${postBootStatus.data.isBootstrapped}`);

  // 5. Attempt Re-Bootstrap (Must be BLOCKED with 403)
  console.log('\n[Step 5] Attempting Re-Bootstrap (Testing Security Lock)...');
  const reBootRes = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/bootstrap/init',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    bootstrapKey: 'orca_bootstrap_secure_key_2026_production_safe',
    adminName: 'هاكر',
    username: 'hacker',
    password: 'password',
  });
  console.log(`Status: ${reBootRes.status}, Error:`, reBootRes.data.error);
  if (reBootRes.status === 403) {
    console.log('✅ RE-BOOTSTRAP IS PERMANENTLY LOCKED (403)');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 BOOTSTRAP SECURITY LIFECYCLE TEST COMPLETED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runBootstrapTest().catch(console.error);
