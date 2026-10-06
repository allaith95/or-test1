import { createWorker } from 'tesseract.js';
import { parseSyrianId } from '../src/utils/syrianIdParser.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🧪 REALISTIC OCR BENCHMARK: DEGRADED LIGHTING & BACKGROUND NOISE');
  console.log('================================================================\n');

  const imagePath = path.resolve('test-fixtures/id-sample-realistic.jpg');
  if (!fs.existsSync(imagePath)) {
    console.error('Test image not found:', imagePath);
    process.exit(1);
  }

  const rawBuffer = fs.readFileSync(imagePath);
  console.log(`Loaded realistic test fixture: ${imagePath} (${fs.statSync(imagePath).size} bytes)`);

  console.log('\nInitializing Tesseract with local self-hosted language data (public/tesseract/lang-data)...');
  const worker = await createWorker('ara', 1, {
    langPath: path.resolve('public/tesseract/lang-data'),
    cacheMethod: 'none',
  });

  // 1. Run recognition on realistic degraded image
  console.log('\n--- OCR Recognition on Realistic Degraded Image ---');
  const t1 = Date.now();
  const res = await worker.recognize(rawBuffer);
  const dur = Date.now() - t1;

  console.log(`- Recognition Time: ${dur} ms`);
  console.log(`- Raw OCR Confidence: ${res.data.confidence}%`);
  console.log('--- Extracted Text ---');
  console.log(res.data.text.trim());
  console.log('----------------------');

  const parsed = parseSyrianId(res.data.text);

  console.log('\n--- Final Extracted Structured Data ---');
  console.log(JSON.stringify({
    firstName: parsed.firstName,
    fatherName: parsed.fatherName,
    lastName: parsed.lastName,
    fullName: parsed.fullName,
    motherName: parsed.motherName,
    nationalId: parsed.nationalId,
    birthDate: parsed.birthDate,
    city: parsed.city,
    overallConfidence: parsed.confidence,
    fieldsStatus: parsed.fieldsStatus
  }, null, 2));

  await worker.terminate();
  console.log('\n================================================================');
  console.log('✅ REALISTIC OCR TEST EXECUTED SUCCESSFULLY');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
