import { ExchangeRateInfo } from '../types/receipt';

// Benchmark RBI & Forex reference exchange rates to INR (1 Foreign Unit = X INR)
export const FALLBACK_RATES: Record<string, ExchangeRateInfo> = {
  INR: { rate: 1.0, name: 'Indian Rupee', symbol: '₹' },
  USD: { rate: 86.85, name: 'US Dollar', symbol: '$' },
  EUR: { rate: 93.40, name: 'Euro', symbol: '€' },
  GBP: { rate: 110.20, name: 'British Pound', symbol: '£' },
  AED: { rate: 23.65, name: 'UAE Dirham', symbol: 'د.إ' },
  SGD: { rate: 64.90, name: 'Singapore Dollar', symbol: 'S$' },
  CAD: { rate: 61.80, name: 'Canadian Dollar', symbol: 'CA$' },
  AUD: { rate: 55.40, name: 'Australian Dollar', symbol: 'A$' },
  JPY: { rate: 0.56, name: 'Japanese Yen', symbol: '¥' },
  SAR: { rate: 23.15, name: 'Saudi Riyal', symbol: '﷼' },
  QAR: { rate: 23.85, name: 'Qatari Riyal', symbol: 'QR' },
  MYR: { rate: 19.80, name: 'Malaysian Ringgit', symbol: 'RM' },
  THB: { rate: 2.45, name: 'Thai Baht', symbol: '฿' },
  KWD: { rate: 282.50, name: 'Kuwaiti Dinar', symbol: 'KD' },
  BHD: { rate: 230.40, name: 'Bahraini Dinar', symbol: 'BD' },
  OMR: { rate: 225.60, name: 'Omani Rial', symbol: 'RO' },
};

export const EXCHANGE_RATE_SOURCE = 'Reserve Bank of India (RBI) Reference Rates & Benchmark Forex';

/**
 * Formats a number into Indian Rupees using the Indian numbering system (Lakhs & Crores).
 * e.g., 123456.78 -> ₹1,23,456.78
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats amount in arbitrary foreign currency
 */
export function formatForeignCurrency(amount: number, currencyCode: string, symbol?: string): string {
  if (symbol && symbol !== '₹') {
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

/**
 * Normalize currency string to clean ISO code
 */
export function normalizeCurrency(currency: string | undefined): string {
  if (!currency) return 'UNKNOWN';
  const upper = currency.toUpperCase().trim();
  if (upper === 'RS' || upper === 'RS.' || upper === 'RUPEES' || upper === 'RUPEE' || upper === '₹' || upper === 'INR') {
    return 'INR';
  }
  if (upper.includes('$') || upper === 'USD') return 'USD';
  if (upper.includes('€') || upper === 'EUR') return 'EUR';
  if (upper.includes('£') || upper === 'GBP') return 'GBP';
  if (upper.includes('AED') || upper.includes('DIRHAM')) return 'AED';
  if (upper.includes('SGD')) return 'SGD';
  if (upper.includes('CAD')) return 'CAD';
  if (upper.includes('AUD')) return 'AUD';
  if (upper.includes('¥') || upper === 'JPY') return 'JPY';
  return upper;
}

/**
 * Fetch latest rates from server, falling back to local benchmarks
 */
export async function getExchangeRates(): Promise<{ rates: Record<string, ExchangeRateInfo>; source: string }> {
  try {
    const res = await fetch('/api/exchange-rates');
    if (res.ok) {
      const data = await res.json();
      return {
        rates: { ...FALLBACK_RATES, ...(data.rates || {}) },
        source: data.source || EXCHANGE_RATE_SOURCE,
      };
    }
  } catch (err) {
    console.warn('Could not fetch latest rates from server, using local RBI benchmarks:', err);
  }
  return {
    rates: FALLBACK_RATES,
    source: EXCHANGE_RATE_SOURCE,
  };
}

/**
 * Convert an amount in foreign currency to INR
 */
export function convertToINR(amount: number, exchangeRate: number): number {
  if (!amount || isNaN(amount)) return 0;
  return Math.round(amount * exchangeRate * 100) / 100;
}
