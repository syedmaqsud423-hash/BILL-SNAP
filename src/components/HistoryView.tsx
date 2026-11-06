import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Download,
  Trash2,
  Calendar,
  Store,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Eye,
  IndianRupee,
  Layers,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import { ReceiptAnalysis } from '../types/receipt';
import { formatINR } from '../utils/currency';
import { exportReceiptToCSV, exportAllReceiptsToCSV } from '../utils/csvExport';

interface HistoryViewProps {
  receipts: ReceiptAnalysis[];
  onDeleteReceipt: (id: string) => void;
  onClearAll: () => void;
  onSelectReceipt: (receipt: ReceiptAnalysis) => void;
  onNewScan: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  receipts,
  onDeleteReceipt,
  onClearAll,
  onSelectReceipt,
  onNewScan,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Aggregate Metrics in INR
  const metrics = useMemo(() => {
    const totalINR = receipts.reduce((acc, r) => acc + (Number(r.inrTotalAmount) || 0), 0);
    const totalTaxINR = receipts.reduce((acc, r) => acc + (Number(r.inrTotalTax) || 0), 0);
    const avgINR = receipts.length > 0 ? totalINR / receipts.length : 0;

    // Categories breakdown
    const categoriesMap: Record<string, number> = {};
    receipts.forEach((r) => {
      (r.items || []).forEach((item) => {
        const cat = item.category || 'General';
        const inr = item.lineTotal * (r.appliedExchangeRate || 1);
        categoriesMap[cat] = (categoriesMap[cat] || 0) + inr;
      });
    });

    const topCategory = Object.entries(categoriesMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Groceries';

    return {
      totalINR,
      totalTaxINR,
      avgINR,
      topCategory,
      count: receipts.length,
    };
  }, [receipts]);

  // Filtered & Sorted receipts
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        const matchSearch =
          r.merchantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (r.merchantGstin && r.merchantGstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (r.items && r.items.some((i) => i.description.toLowerCase().includes(searchTerm.toLowerCase())));

        const matchCurrency =
          selectedCurrencyFilter === 'ALL' ||
          (selectedCurrencyFilter === 'INR' && !r.isForeignCurrency) ||
          (selectedCurrencyFilter === 'FOREIGN' && r.isForeignCurrency);

        return matchSearch && matchCurrency;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === 'amount-desc') return b.inrTotalAmount - a.inrTotalAmount;
        if (sortBy === 'amount-asc') return a.inrTotalAmount - b.inrTotalAmount;
        return 0;
      });
  }, [receipts, searchTerm, selectedCurrencyFilter, sortBy]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in">
      {/* Top Banner & KPI Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Scan History &amp; Analytics</span>
          </h2>
          <p className="text-xs text-slate-400">
            All stored locally in browser storage &bull; Displayed in Indian Rupees (INR)
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {receipts.length > 0 && (
            <button
              onClick={() => exportAllReceiptsToCSV(receipts)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition"
              title="Export all receipts with full itemized breakdown to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export All (CSV)</span>
            </button>
          )}

          <button
            onClick={onNewScan}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40"
          >
            <span>+ Scan New Receipt</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Total Spend (INR)
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono">
            {formatINR(metrics.totalINR)}
          </p>
          <span className="text-[11px] text-slate-500">{metrics.count} receipts recorded</span>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Total GST / Taxes (INR)
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-teal-300 font-mono">
            {formatINR(metrics.totalTaxINR)}
          </p>
          <span className="text-[11px] text-slate-500">CGST, SGST, IGST &amp; Sales Tax</span>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Average / Receipt
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-white font-mono">
            {formatINR(metrics.avgINR)}
          </p>
          <span className="text-[11px] text-slate-500">Median transaction size</span>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
            Top Category
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-300">
            {metrics.topCategory}
          </p>
          <span className="text-[11px] text-slate-500">Largest expenditure share</span>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search merchant, item, GSTIN, or invoice #..."
            className="w-full bg-slate-950 rounded-xl pl-9 pr-4 py-2 text-white border border-slate-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Currency Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 hidden lg:inline">Currency:</span>
          <select
            value={selectedCurrencyFilter}
            onChange={(e) => setSelectedCurrencyFilter(e.target.value)}
            className="bg-slate-950 rounded-xl px-3 py-2 text-white border border-slate-800 focus:outline-none"
          >
            <option value="ALL">All Receipts</option>
            <option value="INR">Native INR (₹) Only</option>
            <option value="FOREIGN">Foreign Converted Only</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 rounded-xl px-3 py-2 text-white border border-slate-800 focus:outline-none"
          >
            <option value="date-desc">Newest Date First</option>
            <option value="date-asc">Oldest Date First</option>
            <option value="amount-desc">Highest Amount (INR)</option>
            <option value="amount-asc">Lowest Amount (INR)</option>
          </select>
        </div>
      </div>

      {/* Receipts List */}
      {filteredReceipts.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-white">No Receipts Found</h3>
            <p className="text-xs text-slate-400">
              {searchTerm || selectedCurrencyFilter !== 'ALL'
                ? 'Try adjusting your search filters or currency selection.'
                : 'You have not scanned any receipts yet. Scan your first receipt or try our pre-loaded samples.'}
            </p>
          </div>
          <button
            onClick={onNewScan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
          >
            Scan a Receipt Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReceipts.map((receipt) => {
            return (
              <div
                key={receipt.id}
                className="group rounded-2xl bg-slate-900 hover:bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 transition shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Merchant & Info */}
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / Icon */}
                    {receipt.imageDataUrl ? (
                      <img
                        src={receipt.imageDataUrl}
                        alt="Receipt thumbnail"
                        className="w-12 h-12 object-cover rounded-xl border border-slate-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold text-lg flex-shrink-0">
                        ₹
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                          {receipt.merchantName}
                        </h4>
                        {receipt.isForeignCurrency ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {receipt.detectedCurrency} &rarr; INR
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            INR Direct
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{receipt.date}</span>
                        </span>
                        {receipt.invoiceNumber && (
                          <span>&bull; Inv: #{receipt.invoiceNumber}</span>
                        )}
                        <span>&bull; {receipt.items.length} items</span>
                        {receipt.paymentMethod && (
                          <span className="text-slate-500">&bull; {receipt.paymentMethod}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts & Quick Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
                    <div className="text-left sm:text-right">
                      <p className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                        {formatINR(receipt.inrTotalAmount)}
                      </p>
                      {receipt.isForeignCurrency && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          ({receipt.totalAmount.toFixed(2)} {receipt.detectedCurrency} @ ₹{receipt.appliedExchangeRate.toFixed(2)})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => exportReceiptToCSV(receipt)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition"
                        title="Download CSV for this receipt"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onSelectReceipt(receipt)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold transition"
                      >
                        <span>View / Edit</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === receipt.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onDeleteReceipt(receipt.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-500"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(receipt.id)}
                          className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Receipt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Item badges preview */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {receipt.items.slice(0, 4).map((item, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-slate-950 px-2 py-0.5 rounded-md text-slate-300 border border-slate-800"
                    >
                      {item.description} ({item.quantity})
                    </span>
                  ))}
                  {receipt.items.length > 4 && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      +{receipt.items.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Danger Zone: Clear History */}
      {receipts.length > 0 && (
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>Local storage holds {receipts.length} verified receipts on this device.</span>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all saved receipt scans from browser storage?')) {
                onClearAll();
              }
            }}
            className="text-rose-400 hover:text-rose-300 font-semibold underline"
          >
            Clear All History
          </button>
        </div>
      )}
    </div>
  );
};
