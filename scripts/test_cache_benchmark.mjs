import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

async function benchmark() {
  console.log('================================================================');
  console.log('🧪 BENCHMARK: COLD vs WARM TESSERACT INITIALIZATION');
  console.log('================================================================\n');

  const imageBuffer = fs.readFileSync('test-fixtures/id-sample.jpg');

  // Test 1: Cold Run (initial worker initialization & lang load)
  console.log('1. Measuring Cold Run (Initial Worker spawn + lang-data load)...');
  const t0 = Date.now();
  const worker1 = await createWorker('ara', 1, {
    langPath: path.resolve('public/tesseract/lang-data'),
    cacheMethod: 'write',
  });
  const tInitCold = Date.now() - t0;
  
  const tRec0 = Date.now();
  const resCold = await worker1.recognize(imageBuffer);
  const tRecCold = Date.now() - tRec0;
  const totalCold = Date.now() - t0;

  console.log(`- Cold Worker Init Time:    ${tInitCold} ms`);
  console.log(`- Cold OCR Recognition Time: ${tRecCold} ms`);
  console.log(`- Total Cold Execution:      ${totalCold} ms\n`);

  // Test 2: Warm Run (subsequent recognition using warm cached worker)
  console.log('2. Measuring Warm Run (Subsequent scan on active worker / cache)...');
  const tWarm0 = Date.now();
  const resWarm = await worker1.recognize(imageBuffer);
  const totalWarm = Date.now() - tWarm0;

  console.log(`- Warm OCR Recognition Time: ${totalWarm} ms (${Math.round(((totalCold - totalWarm) / totalCold) * 100)}% faster than cold initialization)`);

  await worker1.terminate();

  console.log('\n================================================================');
  console.log('✅ BENCHMARK COMPLETED');
  console.log('================================================================');
}

benchmark().catch(console.error);
