import { createWorker } from 'tesseract.js';
import { parseSyrianId } from '../src/utils/syrianIdParser.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🧪 REAL OCR BENCHMARK: TESSERACT.JS ON SYRIAN ID IMAGE');
  console.log('================================================================\n');

  const imagePath = path.resolve('test-fixtures/id-sample.jpg');
  if (!fs.existsSync(imagePath)) {
    console.error('Error: Test image not found at', imagePath);
    process.exit(1);
  }

  console.log('1. Loading image fixture:', imagePath, `(${fs.statSync(imagePath).size} bytes)`);
  const imageBuffer = fs.readFileSync(imagePath);

  console.log('2. Initializing Tesseract.js worker with languages: "ara+eng"...');
  const startTime = Date.now();

  const worker = await createWorker('ara+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r[OCR Progress] ${Math.round(m.progress * 100)}% - recognizing text...`);
      }
    }
  });
  console.log('\nWorker initialized in', Date.now() - startTime, 'ms');

  console.log('3. Running OCR recognition on image...');
  const ocrStartTime = Date.now();
  const result = await worker.recognize(imageBuffer);
  const ocrDuration = Date.now() - ocrStartTime;
  const totalDuration = Date.now() - startTime;

  console.log(`\nOCR Recognition completed in: ${ocrDuration} ms (Total including init: ${totalDuration} ms)\n`);

  const rawText = result.data.text;
  const confidence = result.data.confidence;

  console.log('--- Extracted Raw Text ---');
  console.log(rawText.trim());
  console.log('--------------------------');
  console.log(`OCR Raw Confidence: ${confidence}%`);

  console.log('\n4. Parsing with Syrian ID Civil Parser (syrianIdParser.ts)...');
  const parsed = parseSyrianId(rawText);

  console.log('\n--- Final Parsed Structured Data ---');
  console.log(JSON.stringify({
    firstName: parsed.firstName,
    fatherName: parsed.fatherName,
    lastName: parsed.lastName,
    fullName: parsed.fullName,
    motherName: parsed.motherName,
    nationalId: parsed.nationalId,
    birthDate: parsed.birthDate,
    overallConfidence: parsed.confidence,
    fieldsStatus: parsed.fieldsStatus
  }, null, 2));

  await worker.terminate();
  console.log('\n================================================================');
  console.log('✅ OCR TEST COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('OCR Test failed:', err);
  process.exit(1);
});
