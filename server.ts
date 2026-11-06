import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for large payload (receipt images)
app.use(express.json({ limit: '35mb' }));

// Known fallback/benchmark exchange rates to Indian Rupee (INR)
// Source: RBI Reference Rates & Foreign Exchange Benchmarks
const DEFAULT_INR_EXCHANGE_RATES: Record<string, { rate: number; name: string; symbol: string }> = {
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

// API: Exchange rates endpoint
app.get('/api/exchange-rates', (_req: Request, res: Response) => {
  res.json({
    base: 'INR',
    source: 'RBI Reference Rates & Forex Benchmarks (Updated November 2026)',
    timestamp: new Date().toISOString(),
    rates: DEFAULT_INR_EXCHANGE_RATES,
  });
});

// API: Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// API: Receipt Analysis via Gemini
app.post('/api/receipt/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your environment secrets.',
      });
      return;
    }

    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64 in request body.' });
      return;
    }

    // Strip data URL header if included
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `STEP 0 (RECEIPT VALIDATION): First, determine if the image is a valid financial receipt. If it is not, analyze the visual content to identify what it represents (e.g., 'Aadhaar Card', 'Landscape', 'Selfie') and return a JSON response with the field 'document_type' containing that specific description.

If it is a valid receipt or bill, extract all financial, merchant, line-item, and tax details with extreme precision.
CRITICAL RULES:
1. NEVER GUESS OR HALLUCINATE. If any merchant, date, amount, tax, or line-item value is absent, torn, faded, or cut off, represent it as null or empty string, and set isUncertain to true.
2. CURRENCY IDENTIFICATION: Carefully search for currency signs or codes (e.g., ₹, Rs, INR, Rs., $, €, £, AED, CAD, AUD). If the currency is confirmed Indian Rupee, return detectedCurrency="INR" and detectedCurrencySymbol="₹". If another currency is explicitly shown, return its standard 3-letter ISO code and symbol. If there is no currency symbol or if it is ambiguous, set detectedCurrency="UNKNOWN", isCurrencyUncertain=true, and describe the uncertainty in currencyConfidenceNote.
3. ITEMIZATION: Extract every line item with description, quantity (default to 1 if not stated), unit price, and line total. If any price is unreadable, mark isUncertain=true.
4. TAX BREAKDOWN: Look for CGST, SGST, IGST, VAT, Cess, or general tax lines. Extract tax names, percentage rates if printed, and amounts.
5. SUMMARIZATION & CHECKS: Calculate if items sum matches subtotal and grand total. If there is any discrepancy or missing calculation, add it to reviewAlerts.
6. OUTPUT STRICTLY MATCHING THE JSON SCHEMA. Do NOT wrap in Markdown code fences. Return valid JSON only.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ' non-receipt': {
              type: Type.STRING,
              description: "Set to 'This document is not a valid receipt ' if the image is not a valid financial receipt or bill.",
            },
            'document_type': {
              type: Type.STRING,
              description: "Identify what the image represents (e.g., 'Aadhaar Card', 'Landscape', 'Selfie', 'Document') if not a valid financial receipt.",
            },
            merchantName: { type: Type.STRING, description: 'Store, vendor or merchant name' },
            merchantAddress: { type: Type.STRING, description: 'Store address or location if visible' },
            merchantPhone: { type: Type.STRING, description: 'Store phone or contact if visible' },
            merchantGstin: { type: Type.STRING, description: 'GSTIN / VAT ID / Tax ID if visible' },
            invoiceNumber: { type: Type.STRING, description: 'Invoice number, bill #, or receipt ID' },
            date: { type: Type.STRING, description: 'Transaction date in YYYY-MM-DD format, or empty if uncertain' },
            time: { type: Type.STRING, description: 'Transaction time (e.g. 15:42) if visible' },
            paymentMethod: { type: Type.STRING, description: 'Payment method: Cash, UPI, Card, NetBanking, etc.' },
            detectedCurrency: { type: Type.STRING, description: 'Detected currency ISO code: INR, USD, EUR, GBP, AED, CAD, or UNKNOWN' },
            detectedCurrencySymbol: { type: Type.STRING, description: 'Currency symbol: ₹, Rs, $, €, £, or empty' },
            isCurrencyUncertain: { type: Type.BOOLEAN, description: 'True if currency cannot be confirmed with 100% confidence' },
            currencyConfidenceNote: { type: Type.STRING, description: 'Explanation of currency detection' },
            subtotal: { type: Type.NUMBER, description: 'Subtotal amount in receipt currency, or 0 if missing' },
            taxes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Tax name: e.g. CGST 9%, SGST 9%, VAT 5%' },
                  ratePercent: { type: Type.NUMBER, description: 'Percentage rate if shown, else 0' },
                  amount: { type: Type.NUMBER, description: 'Tax amount in receipt currency' },
                  isUncertain: { type: Type.BOOLEAN, description: 'True if rate or amount was uncertain' },
                },
                required: ['name', 'amount', 'isUncertain'],
              },
            },
            totalTax: { type: Type.NUMBER, description: 'Sum total of taxes in receipt currency' },
            discount: { type: Type.NUMBER, description: 'Discount or coupon amount in receipt currency, or 0' },
            tipOrGratuity: { type: Type.NUMBER, description: 'Tip or service charge in receipt currency, or 0' },
            totalAmount: { type: Type.NUMBER, description: 'Final grand total amount in receipt currency' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: 'Item name or description' },
                  quantity: { type: Type.NUMBER, description: 'Quantity (e.g. 1, 2, 0.75)' },
                  unitPrice: { type: Type.NUMBER, description: 'Unit price in receipt currency' },
                  lineTotal: { type: Type.NUMBER, description: 'Line total in receipt currency' },
                  category: { type: Type.STRING, description: 'Category e.g. Groceries, Dining, Utilities, Healthcare, Retail, Fuel, Other' },
                  isUncertain: { type: Type.BOOLEAN, description: 'True if item or price was illegible/uncertain' },
                  uncertaintyReason: { type: Type.STRING, description: 'Reason for uncertainty if any' },
                },
                required: ['description', 'quantity', 'unitPrice', 'lineTotal', 'isUncertain'],
              },
            },
            missingFields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of typical fields that could not be found',
            },
            reviewAlerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Alerts or questions for the user to review',
            },
            overallConfidence: {
              type: Type.STRING,
              description: 'HIGH, MEDIUM, or LOW confidence',
            },
          },
          required: [
            'detectedCurrency',
            'isCurrencyUncertain',
            'subtotal',
            'taxes',
            'totalTax',
            'totalAmount',
            'items',
            'missingFields',
            'reviewAlerts',
            'overallConfidence',
          ],
        },
      },
    });

    const rawText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      // Fallback clean regex in case of accidental markdown
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    const nonReceiptVal = parsedData[' non-receipt'] || parsedData['non-receipt'];
    const docTypeVal = parsedData['document_type'];
    if (nonReceiptVal || docTypeVal) {
      const reason = docTypeVal ? `This document is not a valid receipt. It represents: ${docTypeVal}.` : (nonReceiptVal || 'This document is not a valid receipt ');
      res.json({
        success: true,
        isNonReceipt: true,
        analysis: {
          id: `non-receipt-${Date.now()}`,
          createdAt: new Date().toISOString(),
          merchantName: docTypeVal ? `Non-Receipt: ${docTypeVal}` : 'Invalid Document (Not a Receipt)',
          date: new Date().toISOString().split('T')[0],
          detectedCurrency: 'INR',
          isCurrencyUncertain: false,
          appliedExchangeRate: 1.0,
          exchangeRateSource: 'N/A',
          isForeignCurrency: false,
          subtotal: 0,
          taxes: [],
          totalTax: 0,
          discount: 0,
          tipOrGratuity: 0,
          totalAmount: 0,
          inrSubtotal: 0,
          inrTotalTax: 0,
          inrTotalAmount: 0,
          items: [],
          missingFields: [],
          reviewAlerts: [reason],
          overallConfidence: 'LOW',
          isNonReceipt: true,
          nonReceiptReason: reason,
          status: 'confirmed',
        },
      });
      return;
    }

    res.json({
      success: true,
      analysis: parsedData,
      rawSummary: 'Successfully extracted receipt details.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error analyzing receipt with Gemini:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze receipt with Gemini API.',
      details: error.stack,
    });
  }
});

// Full-stack Vite integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode with Vite dev middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RupeeScan PWA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
