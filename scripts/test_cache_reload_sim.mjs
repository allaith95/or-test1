import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 BENCHMARK: CACHEMETHOD NONE vs WRITE (PAGE RELOAD SIMULATION)');
  console.log('================================================================\n');

  const imageBuffer = fs.readFileSync('test-fixtures/id-sample.jpg');
  const langPath = path.resolve('public/tesseract/lang-data');

  // Test Suite A: cacheMethod: 'none' (Simulating 2 fresh page loads without caching)
  console.log('--- Suite A: cacheMethod: "none" (No Persistent Cache) ---');
  
  // Load 1
  const tA1_start = Date.now();
  const workerA1 = await createWorker('ara', 1, {
    langPath,
    cacheMethod: 'none',
  });
  await workerA1.recognize(imageBuffer);
  const tA1 = Date.now() - tA1_start;
  await workerA1.terminate();
  console.log(`- Run 1 (Cold Load 1): ${tA1} ms`);

  // Load 2 (Simulating Page Reload F5)
  const tA2_start = Date.now();
  const workerA2 = await createWorker('ara', 1, {
    langPath,
    cacheMethod: 'none',
  });
  await workerA2.recognize(imageBuffer);
  const tA2 = Date.now() - tA2_start;
  await workerA2.terminate();
  console.log(`- Run 2 (Reload Load 2): ${tA2} ms (No cache reuse -> re-reads and uncompresses)\n`);

  // Test Suite B: cacheMethod: 'write' (Simulating 2 loads with Persistent Cache)
  console.log('--- Suite B: cacheMethod: "write" (With Local Cache) ---');
  
  // Load 1
  const tB1_start = Date.now();
  const workerB1 = await createWorker('ara', 1, {
    langPath,
    cacheMethod: 'write',
  });
  await workerB1.recognize(imageBuffer);
  const tB1 = Date.now() - tB1_start;
  await workerB1.terminate();
  console.log(`- Run 1 (Cold Initial Save): ${tB1} ms`);

  // Load 2 (Simulating Page Reload F5 with Cache Hit)
  const tB2_start = Date.now();
  const workerB2 = await createWorker('ara', 1, {
    langPath,
    cacheMethod: 'write',
  });
  await workerB2.recognize(imageBuffer);
  const tB2 = Date.now() - tB2_start;
  await workerB2.terminate();
  console.log(`- Run 2 (Reload Load 2 with Cache): ${tB2} ms (${Math.round(((tA2 - tB2) / tA2) * 100)}% faster initialization on subsequent runs)`);

  console.log('\n================================================================');
  console.log('✅ BENCHMARK COMPLETED');
  console.log('================================================================');
}

runTest().catch(console.error);
