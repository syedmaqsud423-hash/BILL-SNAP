export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  category?: string;
  isUncertain?: boolean;
  uncertaintyReason?: string;
}

export interface ReceiptTax {
  id: string;
  name: string;
  ratePercent?: number;
  amount: number;
  isUncertain?: boolean;
}

export interface ReceiptAnalysis {
  id: string;
  createdAt: string;
  merchantName: string;
  merchantAddress?: string;
  merchantPhone?: string;
  merchantGstin?: string;
  invoiceNumber?: string;
  date: string;
  time?: string;
  paymentMethod?: string;
  
  // Currency handling
  detectedCurrency: string;
  detectedCurrencySymbol?: string;
  isCurrencyUncertain: boolean;
  currencyConfidenceNote?: string;
  appliedExchangeRate: number; // 1.0 for INR
  exchangeRateSource: string;
  isForeignCurrency: boolean;
  
  // Amounts in original currency
  subtotal: number;
  taxes: ReceiptTax[];
  totalTax: number;
  discount: number;
  tipOrGratuity: number;
  totalAmount: number;

  // Amounts in confirmed Indian Rupee (INR)
  inrSubtotal: number;
  inrTotalTax: number;
  inrTotalAmount: number;

  // Items
  items: ReceiptItem[];

  // Data Quality & Verification
  missingFields: string[];
  reviewAlerts: string[];
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Storage & metadata
  imageDataUrl?: string;
  userNotes?: string;
  status: 'draft' | 'confirmed';
  isNonReceipt?: boolean;
  nonReceiptReason?: string;
}

export interface ExchangeRateInfo {
  rate: number;
  name: string;
  symbol: string;
}

export interface ExchangeRatesResponse {
  base: string;
  source: string;
  timestamp: string;
  rates: Record<string, ExchangeRateInfo>;
}
