import assert from 'assert';
import { formatINR, normalizeCurrency, convertToINR, FALLBACK_RATES } from '../src/utils/currency';
import { validateReceipt } from '../src/utils/receiptValidator';
import { ReceiptAnalysis } from '../src/types/receipt';

console.log('🧪 Starting RupeeScan Test Suite...\n');

// Test 1: Currency Normalization
console.log('Test 1: Currency Normalization');
assert.strictEqual(normalizeCurrency('INR'), 'INR');
assert.strictEqual(normalizeCurrency('₹'), 'INR');
assert.strictEqual(normalizeCurrency('Rs.'), 'INR');
assert.strictEqual(normalizeCurrency('Rupees'), 'INR');
assert.strictEqual(normalizeCurrency('$'), 'USD');
assert.strictEqual(normalizeCurrency('USD'), 'USD');
assert.strictEqual(normalizeCurrency('€'), 'EUR');
assert.strictEqual(normalizeCurrency('AED'), 'AED');
assert.strictEqual(normalizeCurrency(''), 'UNKNOWN');
console.log('✅ Passed: Currency Normalization');

// Test 2: Indian Rupee (INR) Formatting (en-IN Lakhs & Crores grouping)
console.log('\nTest 2: Indian Rupee Formatting');
const formattedSmall = formatINR(1441.5);
assert.ok(formattedSmall.includes('1,441.50'), `Expected 1,441.50 but got ${formattedSmall}`);
const formattedLakh = formatINR(125000);
// In en-IN, 125000 is 1,25,000.00
assert.ok(formattedLakh.includes('1,25,000'), `Expected 1,25,000 but got ${formattedLakh}`);
console.log('✅ Passed: Indian Rupee Formatting with en-IN numbering');

// Test 3: Foreign Currency Conversion
console.log('\nTest 3: Foreign Currency Conversion to INR');
const usdRate = 86.85;
const convertedUSD = convertToINR(50, usdRate);
assert.strictEqual(convertedUSD, 4342.5);

const convertedZero = convertToINR(0, usdRate);
assert.strictEqual(convertedZero, 0);
console.log('✅ Passed: Foreign Currency Conversion & rounding');

// Test 4: Receipt Validation Logic
console.log('\nTest 4: Receipt Validation Logic');
const validReceipt: Partial<ReceiptAnalysis> = {
  merchantName: 'Supermarket Plus',
  date: '2026-11-05',
  detectedCurrency: 'INR',
  appliedExchangeRate: 1.0,
  isForeignCurrency: false,
  subtotal: 500,
  totalAmount: 525,
  inrTotalAmount: 525,
  items: [
    {
      id: 'i1',
      description: 'Basmati Rice',
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
    },
  ],
};

const resultValid = validateReceipt(validReceipt);
assert.strictEqual(resultValid.isValid, true);
assert.strictEqual(resultValid.errors.length, 0);
console.log('✅ Passed: Valid receipt passes validation');

// Test 5: Validation catches foreign currency missing rate
console.log('\nTest 5: Foreign currency without rate');
const invalidReceipt: Partial<ReceiptAnalysis> = {
  merchantName: 'NYC Store',
  date: '2026-11-05',
  detectedCurrency: 'USD',
  appliedExchangeRate: 0,
  isForeignCurrency: true,
  items: [],
};
const resultInvalid = validateReceipt(invalidReceipt);
assert.strictEqual(resultInvalid.isValid, false);
assert.ok(resultInvalid.errors.some((e) => e.includes('applied exchange rate')));
console.log('✅ Passed: Detected missing exchange rate on foreign currency');

console.log('\n🎉 ALL 5 TEST SUITES PASSED SUCCESSFULLY!');
