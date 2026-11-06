import { ReceiptAnalysis, ReceiptItem, ReceiptTax } from '../types/receipt';
import { normalizeCurrency, FALLBACK_RATES, convertToINR } from './currency';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a Gemini extraction or user-edited receipt for financial consistency and data integrity.
 */
export function validateReceipt(receipt: Partial<ReceiptAnalysis>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required core fields
  if (!receipt.merchantName || receipt.merchantName.trim() === '') {
    warnings.push('Merchant name is empty or missing.');
  }

  if (!receipt.date || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.date)) {
    warnings.push('Transaction date is not in standard YYYY-MM-DD format.');
  }

  // Currency validation
  const normCurr = normalizeCurrency(receipt.detectedCurrency);
  if (normCurr === 'UNKNOWN') {
    warnings.push('Currency is UNKNOWN. Verification required.');
  }

  if (receipt.isForeignCurrency && (!receipt.appliedExchangeRate || receipt.appliedExchangeRate <= 0)) {
    errors.push('Foreign currency detected but applied exchange rate is invalid or missing.');
  }

  // Items validation
  if (!receipt.items || receipt.items.length === 0) {
    warnings.push('No itemized purchase lines were found on receipt.');
  } else {
    receipt.items.forEach((item: ReceiptItem, idx: number) => {
      if (!item.description || item.description.trim() === '') {
        warnings.push(`Item #${idx + 1} has an empty description.`);
      }
      if (item.quantity <= 0) {
        warnings.push(`Item "${item.description || idx + 1}" has non-positive quantity (${item.quantity}).`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item "${item.description || idx + 1}" has negative unit price (${item.unitPrice}).`);
      }
    });
  }

  // Math sanity check: items line total sum vs subtotal
  if (receipt.items && receipt.items.length > 0) {
    const calculatedSubtotal = receipt.items.reduce((acc, item) => acc + (Number(item.lineTotal) || 0), 0);
    const recordedSubtotal = Number(receipt.subtotal) || 0;
    const diff = Math.abs(calculatedSubtotal - recordedSubtotal);
    if (diff > 1.5 && recordedSubtotal > 0) {
      warnings.push(
        `Subtotal discrepancy: Sum of items (${calculatedSubtotal.toFixed(2)}) differs from receipt subtotal (${recordedSubtotal.toFixed(2)}).`
      );
    }
  }

  // Total check
  if ((receipt.inrTotalAmount ?? 0) <= 0) {
    warnings.push('Total amount in INR is zero or negative.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
