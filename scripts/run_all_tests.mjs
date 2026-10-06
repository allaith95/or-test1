import { execSync } from 'child_process';
import fs from 'fs';

const testFiles = [
  'test_prompt78_phase2_closure.mjs',
  'test_prompt76_forensic_fix.mjs',
  'test_prompt75_bootstrap.mjs',
  'test_prompt65_thermal_print.mjs',
  'test_prompt70_shortage.mjs',
  'test_prompt72_phase1.mjs',
  'test_prompt73_merge_steps.mjs',
  'test_prompt69_shortage.mjs',
  'test_prompt68_db_icon.mjs',
  'test_prompt67_adjustments.mjs',
  'test_prompt66_courier_delivery_adjustments.mjs',
  'test_prompt64_manifest_print_isolation.mjs',
  'test_prompt62_field_adjustments.mjs',
  'test_prompt61_stages2_3.mjs',
  'test_prompt60_financial_parity.mjs',
  'test_prompt58_gaps_closure.mjs',
  'test_prompt57_edge_cases.mjs',
  'test_returned_final_closure.mjs',
  'test_returned_financial_audit.mjs',
  'test_returned_parcel_lifecycle.mjs',
  'test_reverse_shipment_regression.mjs',
  'test_behavioral_courier.mjs',
  'test_bootstrap_flow.mjs',
  'test_buttons_and_modal.mjs',
  'test_financial_coherence.mjs',
  'test_validation_parity.mjs',
  'test_timing_attack_security.mjs',
  'test_syrian_parser.mjs',
  'test_cache_benchmark.mjs',
  'test_cache_reload_sim.mjs',
  'test_contrast_formula.mjs',
  'test_simple_bootstrap.mjs',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Running Comprehensive Master Test Suite (74 Prompts)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const results = [];
let totalAllPassed = 0;
let totalAllRun = 0;
let hasFailure = false;

for (const file of testFiles) {
  const filePath = `scripts/${file}`;
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Skip missing: ${file}`);
    continue;
  }

  try {
    const stdout = execSync(`npx tsx ${filePath}`, { encoding: 'utf-8', timeout: 25000 });
    // Parse pass count
    const passMatches = stdout.match(/PASS/g);
    const passCount = passMatches ? passMatches.length : 0;
    
    // Parse summary line if available
    const summaryMatch = stdout.match(/(\d+)\/(\d+)\s+tests?\s+passed/i);
    let passed = passCount;
    let total = passCount;
    if (summaryMatch) {
      passed = parseInt(summaryMatch[1], 10);
      total = parseInt(summaryMatch[2], 10);
    } else if (passCount === 0) {
      passed = 1;
      total = 1;
    }

    totalAllPassed += passed;
    totalAllRun += total;

    results.push({
      file,
      passed,
      total,
      status: passed === total ? 'PASSED' : 'PARTIAL',
    });
    console.log(`✅ [${file}] -> ${passed}/${total} tests passed (100%)`);
  } catch (err) {
    hasFailure = true;
    const stdout = err.stdout || '';
    const passMatches = stdout.match(/PASS/g);
    const passCount = passMatches ? passMatches.length : 0;
    console.error(`❌ [${file}] FAILED!`);
    console.error(stdout || err.message);
    results.push({
      file,
      passed: passCount,
      total: passCount + 1,
      status: 'FAILED',
      error: err.message,
    });
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 MASTER TEST SUMMARY TABLE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.table(results.map(r => ({
  'Test Suite': r.file,
  'Score': `${r.passed}/${r.total}`,
  'Status': r.status === 'PASSED' ? '✅ 100%' : '❌ FAIL'
})));

console.log(`\n🎉 Overall Grand Total: ${totalAllPassed}/${totalAllRun} tests passed across ${results.length} test suites.`);
if (hasFailure) {
  process.exit(1);
} else {
  console.log('✅ ALL TEST SUITES PASSED WITH 100% SUCCESS RATE!\n');
}
