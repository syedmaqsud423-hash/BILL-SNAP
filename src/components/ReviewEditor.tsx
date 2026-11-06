import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  Trash2,
  Plus,
  ArrowLeft,
  DollarSign,
  IndianRupee,
  Calendar,
  Store,
  FileSpreadsheet,
  FileCheck,
  Eye,
  EyeOff,
  HelpCircle,
  Globe,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ReceiptAnalysis, ReceiptItem, ReceiptTax } from '../types/receipt';
import { formatINR, formatForeignCurrency, FALLBACK_RATES, convertToINR } from '../utils/currency';
import { exportReceiptToCSV } from '../utils/csvExport';

interface ReviewEditorProps {
  initialReceipt: ReceiptAnalysis;
  onSave: (receipt: ReceiptAnalysis) => void;
  onCancel: () => void;
}

export const ReviewEditor: React.FC<ReviewEditorProps> = ({ initialReceipt, onSave, onCancel }) => {
  const [receipt, setReceipt] = useState<ReceiptAnalysis>(initialReceipt);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Currency conversion controls
  const [selectedCurrency, setSelectedCurrency] = useState(receipt.detectedCurrency || 'INR');
  const [customExchangeRate, setCustomExchangeRate] = useState<number>(receipt.appliedExchangeRate || 1.0);
  const [isCurrencyEdited, setIsCurrencyEdited] = useState(false);

  // Recalculate INR amounts whenever original amounts or exchange rate change
  const recalculateAmounts = (
    items: ReceiptItem[],
    taxes: ReceiptTax[],
    discount: number,
    tip: number,
    rate: number
  ) => {
    const subtotal = items.reduce((acc, item) => acc + (Number(item.lineTotal) || 0), 0);
    const totalTax = taxes.reduce((acc, tax) => acc + (Number(tax.amount) || 0), 0);
    const totalAmount = Math.max(0, subtotal + totalTax + (Number(tip) || 0) - (Number(discount) || 0));

    const inrSubtotal = convertToINR(subtotal, rate);
    const inrTotalTax = convertToINR(totalTax, rate);
    const inrTotalAmount = convertToINR(totalAmount, rate);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      inrSubtotal,
      inrTotalTax,
      inrTotalAmount,
    };
  };

  // Update exchange rate or currency
  const handleCurrencyChange = (newCurrency: string) => {
    setSelectedCurrency(newCurrency);
    setIsCurrencyEdited(true);

    let newRate = 1.0;
    let newSource = 'Direct INR transaction (No conversion applied)';
    const isForeign = newCurrency !== 'INR' && newCurrency !== 'UNKNOWN';

    if (isForeign) {
      const known = FALLBACK_RATES[newCurrency];
      newRate = known ? known.rate : customExchangeRate || 1.0;
      newSource = `RBI Reference Benchmark (1 ${newCurrency} = ₹${newRate.toFixed(2)})`;
    }

    setCustomExchangeRate(newRate);

    const calc = recalculateAmounts(receipt.items, receipt.taxes, receipt.discount, receipt.tipOrGratuity, newRate);

    setReceipt((prev) => ({
      ...prev,
      detectedCurrency: newCurrency,
      appliedExchangeRate: newRate,
      exchangeRateSource: newSource,
      isForeignCurrency: isForeign,
      isCurrencyUncertain: false,
      ...calc,
    }));
  };

  const handleRateChange = (newRate: number) => {
    const validRate = isNaN(newRate) || newRate <= 0 ? 1 : newRate;
    setCustomExchangeRate(validRate);
    setIsCurrencyEdited(true);

    const calc = recalculateAmounts(receipt.items, receipt.taxes, receipt.discount, receipt.tipOrGratuity, validRate);

    setReceipt((prev) => ({
      ...prev,
      appliedExchangeRate: validRate,
      exchangeRateSource: `User specified exchange rate (1 ${selectedCurrency} = ₹${validRate.toFixed(2)})`,
      ...calc,
    }));
  };

  // Handle line item edits
  const updateItem = (id: string, field: keyof ReceiptItem, value: any) => {
    setReceipt((prev) => {
      const updatedItems = prev.items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            const q = field === 'quantity' ? Number(value) : item.quantity;
            const u = field === 'unitPrice' ? Number(value) : item.unitPrice;
            updated.lineTotal = Math.round((q * u) * 100) / 100;
          }
          return updated;
        }
        return item;
      });

      const calc = recalculateAmounts(
        updatedItems,
        prev.taxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );

      return {
        ...prev,
        items: updatedItems,
        ...calc,
      };
    });
  };

  // Add line item
  const addItem = () => {
    const newItem: ReceiptItem = {
      id: `item-${Date.now()}`,
      description: 'New Item',
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0,
      category: 'General',
      isUncertain: false,
    };

    setReceipt((prev) => {
      const updatedItems = [...prev.items, newItem];
      const calc = recalculateAmounts(
        updatedItems,
        prev.taxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );
      return {
        ...prev,
        items: updatedItems,
        ...calc,
      };
    });
  };

  // Delete line item
  const deleteItem = (id: string) => {
    setReceipt((prev) => {
      const updatedItems = prev.items.filter((item) => item.id !== id);
      const calc = recalculateAmounts(
        updatedItems,
        prev.taxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );
      return {
        ...prev,
        items: updatedItems,
        ...calc,
      };
    });
  };

  // Handle Tax row edits
  const updateTax = (id: string, field: keyof ReceiptTax, value: any) => {
    setReceipt((prev) => {
      const updatedTaxes = prev.taxes.map((t) => (t.id === id ? { ...t, [field]: value } : t));
      const calc = recalculateAmounts(
        prev.items,
        updatedTaxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );
      return {
        ...prev,
        taxes: updatedTaxes,
        ...calc,
      };
    });
  };

  const addTax = () => {
    const newTax: ReceiptTax = {
      id: `tax-${Date.now()}`,
      name: 'GST / Tax',
      ratePercent: 5.0,
      amount: 0,
      isUncertain: false,
    };
    setReceipt((prev) => {
      const updatedTaxes = [...prev.taxes, newTax];
      const calc = recalculateAmounts(
        prev.items,
        updatedTaxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );
      return {
        ...prev,
        taxes: updatedTaxes,
        ...calc,
      };
    });
  };

  const deleteTax = (id: string) => {
    setReceipt((prev) => {
      const updatedTaxes = prev.taxes.filter((t) => t.id !== id);
      const calc = recalculateAmounts(
        prev.items,
        updatedTaxes,
        prev.discount,
        prev.tipOrGratuity,
        prev.appliedExchangeRate
      );
      return {
        ...prev,
        taxes: updatedTaxes,
        ...calc,
      };
    });
  };

  // Check how many items or fields are uncertain or missing
  const uncertainItemsCount = useMemo(() => {
    return receipt.items.filter((i) => i.isUncertain).length;
  }, [receipt.items]);

  const hasMissingCrucial = !receipt.merchantName || !receipt.date || !receipt.inrTotalAmount;

  // Handle Save
  const handleSaveConfirmed = () => {
    const finalReceipt: ReceiptAnalysis = {
      ...receipt,
      status: 'confirmed',
    };
    onSave(finalReceipt);
    setSaveSuccessNotice(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
            title="Back to Scan"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span>Review &amp; Edit Receipt</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Step 2 of 2
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Verify Gemini extraction results. Highlighted items indicate uncertainty or foreign currency conversion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {receipt.imageDataUrl && (
            <button
              onClick={() => setShowImagePreview(!showImagePreview)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
            >
              {showImagePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showImagePreview ? 'Hide Receipt' : 'View Original'}</span>
            </button>
          )}

          <button
            onClick={() => exportReceiptToCSV(receipt)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={handleSaveConfirmed}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save to History</span>
          </button>
        </div>
      </div>

      {/* Image Preview drawer if enabled */}
      {showImagePreview && receipt.imageDataUrl && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Original Scanned Receipt Image</span>
            <span>Check against original line totals</span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl bg-slate-950 p-2 flex justify-center">
            <img
              src={receipt.imageDataUrl}
              alt="Scanned receipt preview"
              className="max-h-64 object-contain rounded-lg border border-slate-800"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. NON-RECEIPT OR CURRENCY POLICY BANNER */}
      {/* ========================================================= */}
      {receipt.isNonReceipt ? (
        <div className="rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-rose-300">
                Invalid Document Detected
              </h3>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                {receipt.nonReceiptReason || 'This document is not a valid receipt '} It has been saved to your history for your records.
              </p>
            </div>
          </div>
        </div>
      ) : receipt.isForeignCurrency ? (
        <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Globe className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-amber-300">
                  Foreign Currency Detected: {receipt.detectedCurrency} ({receipt.detectedCurrencySymbol || '$'})
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  User Review Required
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                As per accounting standards, this receipt has been converted to <strong>Indian Rupees (INR)</strong>.
                Exchange Rate Source: <strong>{receipt.exchangeRateSource}</strong>.
              </p>
            </div>
          </div>

          {/* Interactive Currency & Rate Adjuster */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-500/20 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Receipt Currency</label>
              <select
                value={selectedCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none"
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="AED">AED — UAE Dirham (د.إ)</option>
                <option value="SGD">SGD — Singapore Dollar (S$)</option>
                <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                <option value="AUD">AUD — Australian Dollar (A$)</option>
                <option value="JPY">JPY — Japanese Yen (¥)</option>
                <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                <option value="QAR">QAR — Qatari Riyal (QR)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Exchange Rate (1 {selectedCurrency} = ₹ INR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={customExchangeRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-white font-mono font-medium focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col justify-end">
              <div className="bg-slate-900/80 rounded-xl p-2.5 border border-amber-500/30 text-amber-200 flex items-center justify-between">
                <span>Total in INR:</span>
                <span className="font-bold text-sm text-emerald-400">{formatINR(receipt.inrTotalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : receipt.isCurrencyUncertain ? (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-amber-200">
            <h4 className="font-semibold text-amber-300">Currency Uncertainty Flagged</h4>
            <p>
              The currency on this receipt was not clearly marked or is ambiguous. Please select the correct currency below to ensure amounts are properly labeled.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => handleCurrencyChange('INR')}
                className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition"
              >
                Confirm as Indian Rupee (INR ₹)
              </button>
              <button
                onClick={() => handleCurrencyChange('USD')}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition"
              >
                Switch to USD ($)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Confirmed Indian Rupee (INR) Receipt</strong> &bull; Native transaction amounts verified without conversion.
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
            INR (₹)
          </span>
        </div>
      )}

      {/* Uncertainty & Missing Notice if any */}
      {(receipt.reviewAlerts.length > 0 || uncertainItemsCount > 0 || receipt.missingFields.length > 0) && (
        <div className="rounded-2xl bg-slate-900 border border-amber-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Attention Items Flagged for Review:</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
            {receipt.reviewAlerts.map((alert, idx) => (
              <li key={`alert-${idx}`}>{alert}</li>
            ))}
            {uncertainItemsCount > 0 && (
              <li>
                {uncertainItemsCount} line item(s) have uncertain quantities or prices (marked with amber badge).
              </li>
            )}
            {receipt.missingFields.map((field, idx) => (
              <li key={`missing-${idx}`}>Missing field: {field}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MERCHANT & TRANSACTION DETAILS */}
      {/* ========================================================= */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-400" />
          <span>Merchant &amp; Transaction Details</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Merchant / Store Name *</label>
            <input
              type="text"
              value={receipt.merchantName}
              onChange={(e) => setReceipt({ ...receipt, merchantName: e.target.value })}
              className={`w-full bg-slate-950 rounded-xl px-3 py-2 text-white border focus:outline-none ${
                !receipt.merchantName ? 'border-amber-500/60' : 'border-slate-800 focus:border-emerald-500'
              }`}
              placeholder="e.g. Nature's Basket"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Transaction Date (YYYY-MM-DD) *</label>
            <input
              type="date"
              value={receipt.date}
              onChange={(e) => setReceipt({ ...receipt, date: e.target.value })}
              className={`w-full bg-slate-950 rounded-xl px-3 py-2 text-white border focus:outline-none ${
                !receipt.date ? 'border-amber-500/60' : 'border-slate-800 focus:border-emerald-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Invoice / Bill Number</label>
            <input
              type="text"
              value={receipt.invoiceNumber || ''}
              onChange={(e) => setReceipt({ ...receipt, invoiceNumber: e.target.value })}
              className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white border border-slate-800 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. INV-98124"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">GSTIN / Tax ID</label>
            <input
              type="text"
              value={receipt.merchantGstin || ''}
              onChange={(e) => setReceipt({ ...receipt, merchantGstin: e.target.value })}
              className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white font-mono border border-slate-800 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 27AABCN1234F1Z8"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Payment Mode</label>
            <input
              type="text"
              value={receipt.paymentMethod || ''}
              onChange={(e) => setReceipt({ ...receipt, paymentMethod: e.target.value })}
              className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white border border-slate-800 focus:border-emerald-500 focus:outline-none"
              placeholder="UPI, Cash, Card"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Store Address / City</label>
            <input
              type="text"
              value={receipt.merchantAddress || ''}
              onChange={(e) => setReceipt({ ...receipt, merchantAddress: e.target.value })}
              className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white border border-slate-800 focus:border-emerald-500 focus:outline-none"
              placeholder="Mumbai, Bengaluru, Delhi"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ITEMIZED PURCHASES TABLE */}
      {/* ========================================================= */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Itemized Purchases ({receipt.items.length} items)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Edit quantities, descriptions, or prices. Amounts automatically calculate into INR.
            </p>
          </div>

          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-2 w-28">Category</th>
                <th className="py-3 px-2 w-16 text-center">Qty</th>
                <th className="py-3 px-2 w-24 text-right">
                  Price ({receipt.detectedCurrency})
                </th>
                <th className="py-3 px-2 w-24 text-right">
                  Total ({receipt.detectedCurrency})
                </th>
                <th className="py-3 px-3 w-28 text-right font-bold text-emerald-400">
                  Total (INR ₹)
                </th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900">
              {receipt.items.map((item, index) => {
                const lineInr = convertToINR(item.lineTotal, receipt.appliedExchangeRate);
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/40 transition ${
                      item.isUncertain ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1 text-white font-medium focus:outline-none"
                        />
                        {item.isUncertain && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{item.uncertaintyReason || 'Uncertain OCR reading'}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-2">
                      <select
                        value={item.category || 'General'}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-[11px] focus:outline-none"
                      >
                        <option value="Groceries">Groceries</option>
                        <option value="Dining">Dining</option>
                        <option value="Bakery">Bakery</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Fuel">Fuel</option>
                        <option value="Books">Books</option>
                        <option value="Travel">Travel</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Apparel">Apparel</option>
                        <option value="General">General</option>
                      </select>
                    </td>

                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/60 border border-slate-800 text-center rounded-lg px-1.5 py-1 text-white font-mono focus:outline-none"
                      />
                    </td>

                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950/60 border border-slate-800 text-right rounded-lg px-2 py-1 text-white font-mono focus:outline-none"
                      />
                    </td>

                    <td className="py-2 px-2 text-right font-mono text-slate-300">
                      {item.lineTotal.toFixed(2)}
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{lineInr.toFixed(2)}
                    </td>

                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. TAX BREAKDOWN & CHARGES */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Taxes */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Tax Breakdown (CGST, SGST, VAT)</span>
            </h3>
            <button
              onClick={addTax}
              className="text-xs text-emerald-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Tax</span>
            </button>
          </div>

          <div className="space-y-2">
            {receipt.taxes.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No explicit tax lines extracted.</p>
            ) : (
              receipt.taxes.map((tax) => {
                const taxInr = convertToINR(tax.amount, receipt.appliedExchangeRate);
                return (
                  <div
                    key={tax.id}
                    className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs"
                  >
                    <input
                      type="text"
                      value={tax.name}
                      onChange={(e) => updateTax(tax.id, 'name', e.target.value)}
                      className="flex-1 bg-transparent border-none text-white font-medium focus:outline-none"
                      placeholder="Tax Name (e.g. CGST 2.5%)"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-[11px]">{receipt.detectedCurrency}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={tax.amount}
                        onChange={(e) => updateTax(tax.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-900 rounded px-1.5 py-0.5 text-right font-mono text-white focus:outline-none"
                      />
                    </div>
                    <span className="text-emerald-400 font-mono font-bold pl-1">
                      ₹{taxInr.toFixed(2)}
                    </span>
                    <button
                      onClick={() => deleteTax(tax.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Discounts & Adjustments */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Discounts, Tips &amp; Notes</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Discount ({receipt.detectedCurrency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={receipt.discount}
                onChange={(e) => {
                  const d = parseFloat(e.target.value) || 0;
                  const calc = recalculateAmounts(
                    receipt.items,
                    receipt.taxes,
                    d,
                    receipt.tipOrGratuity,
                    receipt.appliedExchangeRate
                  );
                  setReceipt({ ...receipt, discount: d, ...calc });
                }}
                className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white font-mono border border-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Tip / Service Charge ({receipt.detectedCurrency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={receipt.tipOrGratuity}
                onChange={(e) => {
                  const tip = parseFloat(e.target.value) || 0;
                  const calc = recalculateAmounts(
                    receipt.items,
                    receipt.taxes,
                    receipt.discount,
                    tip,
                    receipt.appliedExchangeRate
                  );
                  setReceipt({ ...receipt, tipOrGratuity: tip, ...calc });
                }}
                className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white font-mono border border-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-xs">Personal Note / Tag</label>
            <input
              type="text"
              value={receipt.userNotes || ''}
              onChange={(e) => setReceipt({ ...receipt, userNotes: e.target.value })}
              className="w-full bg-slate-950 rounded-xl px-3 py-2 text-white text-xs border border-slate-800 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. Office lunch claim, Home supplies, Tax deductible"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. FINAL FINANCIAL SUMMARY CARD (IN INDIAN RUPEES) */}
      {/* ========================================================= */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border border-emerald-500/30 p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Verified Accounting Total
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
              Final Amount in Indian Rupees (INR)
            </h3>
            {receipt.isForeignCurrency && (
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated from {receipt.totalAmount.toFixed(2)} {receipt.detectedCurrency} @ ₹
                {receipt.appliedExchangeRate.toFixed(2)} / {receipt.detectedCurrency}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 font-mono tracking-tight">
              {formatINR(receipt.inrTotalAmount)}
            </div>
            <span className="text-xs text-slate-400">Total payable in INR (₹)</span>
          </div>
        </div>

        {/* Subtotal & Tax Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block mb-0.5">Subtotal (INR)</span>
            <span className="font-bold text-white font-mono text-sm">{formatINR(receipt.inrSubtotal)}</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block mb-0.5">Total Taxes (INR)</span>
            <span className="font-bold text-white font-mono text-sm">{formatINR(receipt.inrTotalTax)}</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block mb-0.5">Exchange Rate</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">
              ₹{receipt.appliedExchangeRate.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-400 block mb-0.5">Confidence</span>
            <span
              className={`font-bold text-xs uppercase px-2 py-0.5 rounded-full inline-block ${
                receipt.overallConfidence === 'HIGH'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {receipt.overallConfidence} Quality
            </span>
          </div>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccessNotice && (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/40 p-4 text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Receipt saved successfully to browser local storage history!</span>
          </div>
          <button
            onClick={() => exportReceiptToCSV(receipt)}
            className="text-xs font-bold text-white underline hover:no-underline"
          >
            Download CSV &rarr;
          </button>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
        <button
          onClick={onCancel}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
        >
          Discard &amp; Scan Another
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => exportReceiptToCSV(receipt)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export to CSV</span>
          </button>

          <button
            onClick={handleSaveConfirmed}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-xl shadow-emerald-950/60 transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Confirm &amp; Save Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
