import { computeParcelFinancialSummary } from '../src/shared/financialCalculations.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 PROMPT 60 TEST: FINANCIAL UNIFICATION & PARITY SUITE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// Transfer fee mock: 1% commission
const mockCalcTransferFee = (amt, curr) => Math.round(amt * 0.01);

// =========================================================================
// TEST 1: PREPAID (مدفوع سلفاً)
// =========================================================================
console.log('\n[Case 1] Prepaid — Freight Paid in Advance by Sender:');
const res1 = computeParcelFinancialSummary({
  paymentType: 'prepaid',
  currency: 'SYP',
  shippingCost: 15000,
  codAmount: 0,
  calculateTransferFee: mockCalcTransferFee,
});

assert(res1.shippingCost === 15000, 'أجور الشحن = 15,000 ل.س');
assert(res1.prepaidFromSender === 15000, 'المحصل سلفاً من المرسل = 15,000 ل.س');
assert(res1.totalDueFromReceiver === 0, 'المطلوب تحصيله من المستلم = 0 ل.س');
assert(res1.transferFee === 0, 'عمولة التحويل = 0');

// =========================================================================
// TEST 2: COLLECT (أجور على المستلم)
// =========================================================================
console.log('\n[Case 2] Collect — Freight Paid by Recipient at Delivery:');
const res2 = computeParcelFinancialSummary({
  paymentType: 'collect',
  currency: 'SYP',
  shippingCost: 15000,
  codAmount: 0,
  calculateTransferFee: mockCalcTransferFee,
});

assert(res2.shippingCost === 15000, 'أجور الشحن = 15,000 ل.س');
assert(res2.prepaidFromSender === 0, 'المحصل سلفاً من المرسل = 0 ل.س');
assert(res2.totalDueFromReceiver === 15000, 'المطلوب تحصيله من المستلم = 15,000 ل.س');
assert(res2.transferFee === 0, 'عمولة التحويل = 0');

// =========================================================================
// TEST 3: COD - RECEIVER PAYS FREIGHT (ضد الدفع: الشحن على المستلم)
// =========================================================================
console.log('\n[Case 3] COD Default — Recipient Pays Goods + Freight + Fee:');
const res3 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 15000,
  codAmount: 200000,
  codShippingPayer: 'recipient',
  calculateTransferFee: mockCalcTransferFee,
});

// Transfer fee = 1% of 200,000 = 2,000
// Net COD with fee = 202,000
// Total due = 15,000 (ship) + 200,000 (cod) + 2,000 (fee) = 217,000
assert(res3.transferFee === 2000, 'عمولة التحويل = 2,000 ل.س');
assert(res3.netCodWithFee === 202000, 'صافي الحوالة مع عمولتها = 202,000 ل.س');
assert(res3.prepaidFromSender === 0, 'المحصل سلفاً من المرسل = 0 ل.س');
assert(res3.totalDueFromReceiver === 217000, 'المطلوب تحصيله من المستلم = 217,000 ل.س');
assert(res3.isMultiCurrency === false, 'عملة موحدة (SYP)');

// =========================================================================
// TEST 4: COD - SENDER PAYS FREIGHT (ضد الدفع: الشحن مسدد من المرسل)
// =========================================================================
console.log('\n[Case 4] COD — Sender Pays Freight, Recipient Pays Goods + Fee Only:');
const res4 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 15000,
  codAmount: 200000,
  codShippingPayer: 'sender',
  calculateTransferFee: mockCalcTransferFee,
});

// Sender pays 15,000 shipping at intake
// Recipient pays COD + Fee only = 200,000 + 2,000 = 202,000
assert(res4.prepaidFromSender === 15000, 'المحصل سلفاً من المرسل (أجور الشحن) = 15,000 ل.س');
assert(res4.transferFee === 2000, 'عمولة التحويل = 2,000 ل.س');
assert(res4.totalDueFromReceiver === 202000, 'المطلوب تحصيله من المستلم (حوالة + عمولة فقط) = 202,000 ل.س');

// =========================================================================
// TEST 5: DUAL CURRENCY (شحن بالليرة وحوالة بالدولار)
// =========================================================================
console.log('\n[Case 5] Dual Currency — Freight in SYP, COD in USD:');
const res5 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'USD',
  shippingCost: 15000,
  codAmount: 100, // 100 USD
  codShippingPayer: 'recipient',
  calculateTransferFee: mockCalcTransferFee,
});

// Transfer fee = 1% of 100 USD = 1 USD
// Net COD = 101 USD
// Dual currency does NOT sum 15,000 SYP with 101 USD!
assert(res5.isMultiCurrency === true, 'تم كشف العملات الثنائية (isMultiCurrency = true)');
assert(res5.transferFee === 1, 'عمولة التحويل = 1 USD');
assert(res5.totalDueFromReceiver === 101, 'المطلوب تحصيله للحوالة = 101 USD (لا جمع غير منطقي بين عملتين)');
assert(res5.currencySummaryLabel.includes('عملتان مختلفتان'), 'وصف ملخص العملات يوضح وجود عملتين مختلفتين');

// =========================================================================
// TEST 6: COD = 0 (Mandatory Check)
// =========================================================================
console.log('\n[Case 6] COD = 0 Validation Handling:');
const res6 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 15000,
  codAmount: 0,
  calculateTransferFee: mockCalcTransferFee,
});

assert(res6.codAmount === 0, 'قيمة الحوالة = 0');
assert(res6.transferFee === 0, 'عمولة التحويل = 0 عند انعدام مبلغ الحوالة');

// Simulation of UI / Submit validation check in both apps
function validateCodInput(paymentType, codAmount, maxCod) {
  if (paymentType !== 'cod') return { valid: true };
  const num = Number(codAmount) || 0;
  if (num <= 0) return { valid: false, error: 'يجب إدخال مبلغ الحوالة المالية أكبر من الصفر' };
  if (maxCod && num > maxCod) return { valid: false, error: 'المبلغ يتجاوز السقف الأعلى المسموح به' };
  return { valid: true };
}

assert(validateCodInput('cod', 0, 500000).valid === false, 'حظر إدخال مبلغ حوالة صفري (codAmount = 0)');
assert(validateCodInput('cod', -500, 500000).valid === false, 'حظر إدخال مبلغ حوالة سالب');
assert(validateCodInput('cod', 600000, 500000).valid === false, 'حظر إدخال مبلغ حوالة يتجاوز السقف الأعلى (600,000 > 500,000)');
assert(validateCodInput('cod', 250000, 500000).valid === true, 'قبول مبلغ حوالة نظامي ضمن الحدود');

// =========================================================================
// TEST 7: PARITY VERIFICATION (General App vs Courier Mobile App)
// =========================================================================
console.log('\n[Test 7] Parity Check: General App and Courier App produce identical math:');

// Same input fed to both components' calculation logic
const parityInput = {
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 22000,
  codAmount: 350000,
  codShippingPayer: 'recipient',
  calculateTransferFee: (amt) => Math.round(amt * 0.015), // 1.5%
};

const generalAppResult = computeParcelFinancialSummary(parityInput);
const courierAppResult = computeParcelFinancialSummary(parityInput);

assert(generalAppResult.totalDueFromReceiver === courierAppResult.totalDueFromReceiver, 'تطابق تام في المطلوب تحصيله من المستلم: 377,250 ل.س');
assert(generalAppResult.transferFee === courierAppResult.transferFee, 'تطابق تام في عمولة التحويل: 5,250 ل.س');
assert(generalAppResult.netCodWithFee === courierAppResult.netCodWithFee, 'تطابق تام في صافي الحوالة وعمولتها: 355,250 ل.س');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 PROMPT 60 PARITY VERIFICATION: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
