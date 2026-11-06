import { ReceiptAnalysis } from '../types/receipt';
import { formatINR } from './currency';

/**
 * Escapes a cell value for CSV (RFC 4180 compliant)
 */
function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export a single receipt analysis to CSV with itemized details
 */
export function exportReceiptToCSV(receipt: ReceiptAnalysis): void {
  const headers = [
    'Receipt ID',
    'Merchant Name',
    'Transaction Date',
    'Invoice Number',
    'GSTIN / Tax ID',
    'Payment Method',
    'Detected Currency',
    'Exchange Rate to INR',
    'Exchange Rate Source',
    'Item #',
    'Item Description',
    'Category',
    'Quantity',
    'Unit Price (Orig)',
    'Line Total (Orig)',
    'Line Total (INR)',
    'Item Uncertain?',
    'Taxes Breakdown',
    'Total Tax (INR)',
    'Subtotal (INR)',
    'Grand Total (Orig)',
    'Grand Total (INR)',
    'Data Confidence',
    'Review Alerts',
  ];

  const taxSummary = (receipt.taxes || [])
    .map((t) => `${t.name}: ₹${(t.amount * receipt.appliedExchangeRate).toFixed(2)}`)
    .join('; ');

  const alertsSummary = (receipt.reviewAlerts || []).join('; ');

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  if (!receipt.items || receipt.items.length === 0) {
    // Single row if no line items
    const row = [
      receipt.id,
      receipt.merchantName,
      receipt.date,
      receipt.invoiceNumber || '',
      receipt.merchantGstin || '',
      receipt.paymentMethod || '',
      receipt.detectedCurrency,
      receipt.appliedExchangeRate.toFixed(4),
      receipt.exchangeRateSource,
      1,
      'Total Bill Summary',
      'General',
      1,
      receipt.totalAmount.toFixed(2),
      receipt.totalAmount.toFixed(2),
      receipt.inrTotalAmount.toFixed(2),
      'No',
      taxSummary,
      receipt.inrTotalTax.toFixed(2),
      receipt.inrSubtotal.toFixed(2),
      `${receipt.totalAmount.toFixed(2)} ${receipt.detectedCurrency}`,
      `₹${receipt.inrTotalAmount.toFixed(2)}`,
      receipt.overallConfidence,
      alertsSummary,
    ];
    rows.push(row.map(escapeCSV).join(','));
  } else {
    receipt.items.forEach((item, index) => {
      const lineTotalInr = (item.lineTotal * receipt.appliedExchangeRate).toFixed(2);
      const row = [
        receipt.id,
        receipt.merchantName,
        receipt.date,
        receipt.invoiceNumber || '',
        receipt.merchantGstin || '',
        receipt.paymentMethod || '',
        receipt.detectedCurrency,
        receipt.appliedExchangeRate.toFixed(4),
        receipt.exchangeRateSource,
        index + 1,
        item.description,
        item.category || 'General',
        item.quantity,
        item.unitPrice.toFixed(2),
        item.lineTotal.toFixed(2),
        lineTotalInr,
        item.isUncertain ? `Yes: ${item.uncertaintyReason || 'Unclear'}` : 'No',
        index === 0 ? taxSummary : '',
        index === 0 ? receipt.inrTotalTax.toFixed(2) : '',
        index === 0 ? receipt.inrSubtotal.toFixed(2) : '',
        index === 0 ? `${receipt.totalAmount.toFixed(2)} ${receipt.detectedCurrency}` : '',
        index === 0 ? `₹${receipt.inrTotalAmount.toFixed(2)}` : '',
        receipt.overallConfidence,
        index === 0 ? alertsSummary : '',
      ];
      rows.push(row.map(escapeCSV).join(','));
    });
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const cleanMerchant = (receipt.merchantName || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `RupeeScan_${cleanMerchant}_${receipt.date || 'scanned'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export entire scan history as combined CSV with all itemized lines
 */
export function exportAllReceiptsToCSV(receipts: ReceiptAnalysis[]): void {
  if (receipts.length === 0) return;

  const headers = [
    'Receipt ID',
    'Merchant Name',
    'Transaction Date',
    'Invoice Number',
    'GSTIN',
    'Payment Method',
    'Detected Currency',
    'Exchange Rate to INR',
    'Item #',
    'Item Description',
    'Category',
    'Quantity',
    'Unit Price (Orig)',
    'Line Total (Orig)',
    'Line Total (INR)',
    'Taxes Breakdown',
    'Receipt Total (INR)',
    'Confidence',
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  receipts.forEach((receipt) => {
    const taxSummary = (receipt.taxes || [])
      .map((t) => `${t.name}: ₹${(t.amount * receipt.appliedExchangeRate).toFixed(2)}`)
      .join('; ');

    if (!receipt.items || receipt.items.length === 0) {
      rows.push(
        [
          receipt.id,
          receipt.merchantName,
          receipt.date,
          receipt.invoiceNumber || '',
          receipt.merchantGstin || '',
          receipt.paymentMethod || '',
          receipt.detectedCurrency,
          receipt.appliedExchangeRate.toFixed(4),
          1,
          'Total Bill Summary',
          'General',
          1,
          receipt.totalAmount.toFixed(2),
          receipt.totalAmount.toFixed(2),
          receipt.inrTotalAmount.toFixed(2),
          taxSummary,
          receipt.inrTotalAmount.toFixed(2),
          receipt.overallConfidence,
        ]
          .map(escapeCSV)
          .join(',')
      );
    } else {
      receipt.items.forEach((item, index) => {
        const lineTotalInr = (item.lineTotal * receipt.appliedExchangeRate).toFixed(2);
        rows.push(
          [
            receipt.id,
            receipt.merchantName,
            receipt.date,
            receipt.invoiceNumber || '',
            receipt.merchantGstin || '',
            receipt.paymentMethod || '',
            receipt.detectedCurrency,
            receipt.appliedExchangeRate.toFixed(4),
            index + 1,
            item.description,
            item.category || 'General',
            item.quantity,
            item.unitPrice.toFixed(2),
            item.lineTotal.toFixed(2),
            lineTotalInr,
            index === 0 ? taxSummary : '',
            index === 0 ? receipt.inrTotalAmount.toFixed(2) : '',
            receipt.overallConfidence,
          ]
            .map(escapeCSV)
            .join(',')
        );
      });
    }
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `RupeeScan_All_Scans_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
