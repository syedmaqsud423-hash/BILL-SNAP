import { ReceiptAnalysis } from '../types/receipt';

const STORAGE_KEY = 'rupeescan_receipts_v1';

export const SAMPLE_RECEIPTS: ReceiptAnalysis[] = [
  {
    id: 'demo-inr-01',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    merchantName: 'Nature’s Basket Supermarket',
    merchantAddress: 'Bandra West, Mumbai, Maharashtra 400050',
    merchantPhone: '+91 22 2642 1234',
    merchantGstin: '27AABCN1234F1Z8',
    invoiceNumber: 'INV-2026-98124',
    date: '2026-11-03',
    time: '18:45',
    paymentMethod: 'UPI (Google Pay)',
    detectedCurrency: 'INR',
    detectedCurrencySymbol: '₹',
    isCurrencyUncertain: false,
    currencyConfidenceNote: 'Explicit ₹ currency symbol and GSTIN on receipt confirmed.',
    appliedExchangeRate: 1.0,
    exchangeRateSource: 'Direct INR transaction (No conversion)',
    isForeignCurrency: false,
    subtotal: 1420.0,
    taxes: [
      { id: 'tax-1', name: 'CGST 2.5%', ratePercent: 2.5, amount: 35.5, isUncertain: false },
      { id: 'tax-2', name: 'SGST 2.5%', ratePercent: 2.5, amount: 35.5, isUncertain: false },
    ],
    totalTax: 71.0,
    discount: 50.0,
    tipOrGratuity: 0,
    totalAmount: 1441.0,
    inrSubtotal: 1420.0,
    inrTotalTax: 71.0,
    inrTotalAmount: 1441.0,
    items: [
      {
        id: 'item-1',
        description: 'Organic A2 Cow Milk (1L)',
        quantity: 2,
        unitPrice: 95.0,
        lineTotal: 190.0,
        category: 'Groceries',
        isUncertain: false,
      },
      {
        id: 'item-2',
        description: 'Artisanal Sourdough Bread (400g)',
        quantity: 1,
        unitPrice: 180.0,
        lineTotal: 180.0,
        category: 'Bakery',
        isUncertain: false,
      },
      {
        id: 'item-3',
        description: 'Alphonso Mango Preserve',
        quantity: 2,
        unitPrice: 275.0,
        lineTotal: 550.0,
        category: 'Groceries',
        isUncertain: false,
      },
      {
        id: 'item-4',
        description: 'Premium Roasted Pistachios (250g)',
        quantity: 1,
        unitPrice: 500.0,
        lineTotal: 500.0,
        category: 'Snacks',
        isUncertain: false,
      },
    ],
    missingFields: [],
    reviewAlerts: [],
    overallConfidence: 'HIGH',
    userNotes: 'Weekly grocery restock for home kitchen.',
    status: 'confirmed',
  },
  {
    id: 'demo-usd-02',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    merchantName: 'The Strand Bookstore & Cafe',
    merchantAddress: '828 Broadway, New York, NY 10003',
    merchantPhone: '+1 (212) 473-1452',
    merchantGstin: '',
    invoiceNumber: 'STR-88419',
    date: '2026-10-31',
    time: '14:20',
    paymentMethod: 'Credit Card (Visa)',
    detectedCurrency: 'USD',
    detectedCurrencySymbol: '$',
    isCurrencyUncertain: false,
    currencyConfidenceNote: 'Printed USD $ currency symbols with NY State sales tax.',
    appliedExchangeRate: 86.85,
    exchangeRateSource: 'Reserve Bank of India (RBI) Reference Benchmark ($1 = ₹86.85)',
    isForeignCurrency: true,
    subtotal: 58.0,
    taxes: [
      { id: 'tax-us-1', name: 'NYC Sales Tax 8.875%', ratePercent: 8.875, amount: 5.15, isUncertain: false },
    ],
    totalTax: 5.15,
    discount: 0,
    tipOrGratuity: 4.0,
    totalAmount: 67.15,
    inrSubtotal: 5037.3,
    inrTotalTax: 447.28,
    inrTotalAmount: 5831.98,
    items: [
      {
        id: 'item-us-1',
        description: 'Hardcover: Thinking Fast and Slow',
        quantity: 1,
        unitPrice: 32.0,
        lineTotal: 32.0,
        category: 'Books',
        isUncertain: false,
      },
      {
        id: 'item-us-2',
        description: 'Linen Journal & Brass Pen',
        quantity: 1,
        unitPrice: 18.0,
        lineTotal: 18.0,
        category: 'Stationery',
        isUncertain: false,
      },
      {
        id: 'item-us-3',
        description: 'Flat White Coffee (Large)',
        quantity: 1,
        unitPrice: 8.0,
        lineTotal: 8.0,
        category: 'Dining',
        isUncertain: false,
      },
    ],
    missingFields: ['GSTIN (Foreign US Store)'],
    reviewAlerts: ['Foreign currency (USD) converted to INR @ 86.85 via RBI reference rate.'],
    overallConfidence: 'HIGH',
    userNotes: 'Business trip book & stationery expense claim.',
    status: 'confirmed',
  },
];

/**
 * Load all saved receipts from localStorage
 */
export function getSavedReceipts(): ReceiptAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with sample receipts on initial first visit
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_RECEIPTS));
      return SAMPLE_RECEIPTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return SAMPLE_RECEIPTS;
  } catch (err) {
    console.error('Error reading saved receipts from localStorage:', err);
    return [];
  }
}

/**
 * Save or update a receipt in localStorage
 */
export function saveReceipt(receipt: ReceiptAnalysis): void {
  try {
    const current = getSavedReceipts();
    const existingIndex = current.findIndex((r) => r.id === receipt.id);
    let updated: ReceiptAnalysis[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...receipt, status: 'confirmed' };
    } else {
      updated = [{ ...receipt, status: 'confirmed' }, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving receipt to localStorage:', err);
    throw new Error('Could not save to browser storage. LocalStorage quota may be full.');
  }
}

/**
 * Delete a receipt by ID
 */
export function deleteReceipt(id: string): void {
  try {
    const current = getSavedReceipts();
    const filtered = current.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting receipt:', err);
  }
}

/**
 * Clear all saved receipts
 */
export function clearAllReceipts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing receipts:', err);
  }
}
