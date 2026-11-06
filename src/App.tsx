import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ReviewEditor } from './components/ReviewEditor';
import { HistoryView } from './components/HistoryView';
import { SetupInstructionsModal } from './components/SetupInstructionsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ReceiptAnalysis } from './types/receipt';
import { getSavedReceipts, saveReceipt, deleteReceipt, clearAllReceipts } from './utils/storage';
import { Shield, Sparkles, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'setup' | 'review'>('scan');
  const [savedReceipts, setSavedReceipts] = useState<ReceiptAnalysis[]>([]);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptAnalysis | null>(null);

  // Load saved receipts on initial mount
  useEffect(() => {
    const list = getSavedReceipts();
    setSavedReceipts(list);
  }, []);

  // When AI extraction completes
  const handleAnalysisComplete = (analysis: ReceiptAnalysis) => {
    setCurrentReceipt(analysis);
    setActiveTab('review');
  };

  // When user confirms and saves receipt from Review step
  const handleSaveConfirmed = (receipt: ReceiptAnalysis) => {
    saveReceipt(receipt);
    const updated = getSavedReceipts();
    setSavedReceipts(updated);
    setCurrentReceipt(null);
    setActiveTab('history');
  };

  // Delete a receipt
  const handleDeleteReceipt = (id: string) => {
    deleteReceipt(id);
    const updated = getSavedReceipts();
    setSavedReceipts(updated);
  };

  // Clear all history
  const handleClearAll = () => {
    clearAllReceipts();
    setSavedReceipts([]);
  };

  // View/Edit an existing saved receipt
  const handleSelectReceipt = (receipt: ReceiptAnalysis) => {
    setCurrentReceipt(receipt);
    setActiveTab('review');
  };

  // Start new scan
  const handleNewScan = () => {
    setCurrentReceipt(null);
    setActiveTab('scan');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* PWA Offline indicator */}
      <OfflineIndicator />

      {/* Main App Navbar */}
      <Navbar
        activeTab={activeTab === 'review' ? 'scan' : activeTab}
        setActiveTab={(tab) => {
          if (tab === 'scan') {
            setCurrentReceipt(null);
          }
          setActiveTab(tab);
        }}
        savedCount={savedReceipts.length}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {activeTab === 'scan' && (
          <ReceiptScanner onAnalysisComplete={handleAnalysisComplete} />
        )}

        {activeTab === 'review' && currentReceipt && (
          <ReviewEditor
            initialReceipt={currentReceipt}
            onSave={handleSaveConfirmed}
            onCancel={handleNewScan}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            receipts={savedReceipts}
            onDeleteReceipt={handleDeleteReceipt}
            onClearAll={handleClearAll}
            onSelectReceipt={handleSelectReceipt}
            onNewScan={handleNewScan}
          />
        )}

        {activeTab === 'setup' && (
          <SetupInstructionsModal onClose={() => setActiveTab('scan')} />
        )}
      </main>

      {/* App Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">RupeeScan PWA</span>
            <span>&bull;</span>
            <span>Gemini 3.8 Flash Multimodal OCR</span>
            <span>&bull;</span>
            <span className="text-emerald-400">Indian Rupees (INR ₹)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setActiveTab('setup')}
              className="hover:text-slate-300 underline"
            >
              API Security &amp; Backend Docs
            </button>
            <span>&bull;</span>
            <span>Offline Ready PWA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
