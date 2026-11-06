import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  Sparkles,
  FileText,
  CheckCircle2,
  Image as ImageIcon,
  SwitchCamera,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ReceiptAnalysis } from '../types/receipt';
import { FALLBACK_RATES, getExchangeRates, convertToINR, normalizeCurrency } from '../utils/currency';
import { saveReceipt } from '../utils/storage';

interface ReceiptScannerProps {
  onAnalysisComplete: (analysis: ReceiptAnalysis) => void;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onAnalysisComplete }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasCameraSupport, setHasCameraSupport] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check camera support on mount
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraSupport(false);
    }
  }, []);

  // Stop camera stream helper
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Start live camera
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      stopCameraStream();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.warn('Direct camera access error:', err);
      setErrorMessage(
        'Could not access device camera via MediaDevices API. Please ensure camera permissions are granted in your browser settings or use the separate Upload Receipt File section below.'
      );
    }
  };

  // Flip camera between front and back
  const flipCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // Capture snapshot from live camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImage(dataUrl);
      stopCameraStream();
      analyzeReceiptImage(dataUrl);
    }
  };

  // Resize large image to optimal processing dimension (max 1600px)
  const processImageFile = (file: File) => {
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setSelectedImage(compressedDataUrl);
          analyzeReceiptImage(compressedDataUrl);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // File drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Send to backend Gemini proxy
  const analyzeReceiptImage = async (dataUrl: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisStep('Optimizing receipt image & preparing request...');

    try {
      // Step 1: Pre-fetch exchange rates in parallel
      setAnalysisStep('Contacting backend Gemini 3.8 Flash model...');
      const ratesDataPromise = getExchangeRates();

      // Step 2: Call backend API
      const response = await fetch('/api/receipt/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: 'image/jpeg',
        }),
      });

      setAnalysisStep('Parsing structured JSON & verifying financial amounts...');

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(
          errorJson.error || `Server returned error (${response.status}): Failed to analyze receipt.`
        );
      }

      const resData = await response.json();
      if (!resData.success || !resData.analysis) {
        throw new Error(resData.error || 'Gemini could not extract receipt details.');
      }

      const rawAnalysis = resData.analysis;

      if (rawAnalysis.isNonReceipt) {
        const nonReceiptRecord: ReceiptAnalysis = {
          id: `non-receipt-${Date.now()}`,
          createdAt: new Date().toISOString(),
          merchantName: 'Invalid Document (Not a Receipt)',
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
          reviewAlerts: [rawAnalysis.nonReceiptReason || 'This document is not a valid receipt '],
          overallConfidence: 'LOW',
          imageDataUrl: dataUrl,
          userNotes: 'Auto-saved non-receipt document.',
          status: 'confirmed',
          isNonReceipt: true,
          nonReceiptReason: rawAnalysis.nonReceiptReason || 'This document is not a valid receipt ',
        };

        saveReceipt(nonReceiptRecord);
        onAnalysisComplete(nonReceiptRecord);
        return;
      }

      setAnalysisStep('Validating Indian Rupee conversion and tax breakdowns...');
      const { rates, source: rateSource } = await ratesDataPromise;

      // Currency processing & verification
      const normCurrency = normalizeCurrency(rawAnalysis.detectedCurrency);
      const isINR = normCurrency === 'INR';
      const isForeign = !isINR && normCurrency !== 'UNKNOWN';

      let exchangeRate = 1.0;
      let appliedSource = 'Direct INR transaction (No conversion applied)';

      if (isForeign) {
        const rateObj = rates[normCurrency] || FALLBACK_RATES[normCurrency];
        if (rateObj) {
          exchangeRate = rateObj.rate;
          appliedSource = `${rateSource} (1 ${normCurrency} = ₹${rateObj.rate.toFixed(2)})`;
        } else {
          // Unknown foreign currency rate fallback
          exchangeRate = 1.0;
          appliedSource = `Unlisted currency (${normCurrency}) - Rate requires manual verification`;
        }
      }

      // Convert financial figures to INR
      const inrSubtotal = convertToINR(rawAnalysis.subtotal || 0, exchangeRate);
      const inrTotalTax = convertToINR(rawAnalysis.totalTax || 0, exchangeRate);
      const inrTotalAmount = convertToINR(rawAnalysis.totalAmount || 0, exchangeRate);

      // Construct verified receipt object
      const verifiedReceipt: ReceiptAnalysis = {
        id: `scan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        merchantName: rawAnalysis.merchantName || 'Unknown Merchant',
        merchantAddress: rawAnalysis.merchantAddress || '',
        merchantPhone: rawAnalysis.merchantPhone || '',
        merchantGstin: rawAnalysis.merchantGstin || '',
        invoiceNumber: rawAnalysis.invoiceNumber || '',
        date: rawAnalysis.date || new Date().toISOString().split('T')[0],
        time: rawAnalysis.time || '',
        paymentMethod: rawAnalysis.paymentMethod || 'Cash / Card',
        
        detectedCurrency: normCurrency,
        detectedCurrencySymbol: rawAnalysis.detectedCurrencySymbol || (isINR ? '₹' : '$'),
        isCurrencyUncertain: !!rawAnalysis.isCurrencyUncertain,
        currencyConfidenceNote: rawAnalysis.currencyConfidenceNote || (isINR ? 'Receipt confirmed in Indian Rupees (INR)' : 'Foreign currency detected on receipt'),
        appliedExchangeRate: exchangeRate,
        exchangeRateSource: appliedSource,
        isForeignCurrency: isForeign,

        subtotal: rawAnalysis.subtotal || 0,
        taxes: (rawAnalysis.taxes || []).map((t: any, idx: number) => ({
          id: `tax-${idx}`,
          name: t.name || 'Tax',
          ratePercent: t.ratePercent || 0,
          amount: t.amount || 0,
          isUncertain: !!t.isUncertain,
        })),
        totalTax: rawAnalysis.totalTax || 0,
        discount: rawAnalysis.discount || 0,
        tipOrGratuity: rawAnalysis.tipOrGratuity || 0,
        totalAmount: rawAnalysis.totalAmount || 0,

        inrSubtotal,
        inrTotalTax,
        inrTotalAmount,

        items: (rawAnalysis.items || []).map((item: any, idx: number) => ({
          id: `item-${idx}`,
          description: item.description || `Item #${idx + 1}`,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          lineTotal: item.lineTotal || (item.quantity || 1) * (item.unitPrice || 0),
          category: item.category || 'General',
          isUncertain: !!item.isUncertain,
          uncertaintyReason: item.uncertaintyReason || '',
        })),

        missingFields: rawAnalysis.missingFields || [],
        reviewAlerts: rawAnalysis.reviewAlerts || [],
        overallConfidence: rawAnalysis.overallConfidence || 'MEDIUM',
        imageDataUrl: dataUrl,
        userNotes: '',
        status: 'draft',
      };

      // Add warning alert if currency was uncertain or foreign
      if (verifiedReceipt.isCurrencyUncertain) {
        if (!verifiedReceipt.reviewAlerts.includes('Currency symbol is uncertain or missing on receipt.')) {
          verifiedReceipt.reviewAlerts.unshift('Currency symbol is uncertain or missing on receipt. Please verify before confirming.');
        }
      }

      if (verifiedReceipt.isForeignCurrency) {
        verifiedReceipt.reviewAlerts.unshift(
          `Foreign currency (${verifiedReceipt.detectedCurrency}) converted to INR @ ₹${exchangeRate.toFixed(2)} via ${rateSource}.`
        );
      }

      // Hand over to editable review step
      onAnalysisComplete(verifiedReceipt);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error during analysis:', error);
      setErrorMessage(
        error.message ||
          'Failed to communicate with Gemini API. Ensure GEMINI_API_KEY is configured in your project secrets.'
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Sample Demo Receipts for instant testing
  const loadDemoReceipt = (type: 'supermarket' | 'restaurant' | 'foreign') => {
    setErrorMessage(null);
    let sample: ReceiptAnalysis;

    if (type === 'supermarket') {
      sample = {
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        merchantName: 'More Retail Supermarket',
        merchantAddress: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
        merchantPhone: '+91 80 4123 5566',
        merchantGstin: '29AABCM8921K1Z2',
        invoiceNumber: 'MOR-2026-8812',
        date: '2026-11-04',
        time: '19:15',
        paymentMethod: 'UPI (PhonePe)',
        detectedCurrency: 'INR',
        detectedCurrencySymbol: '₹',
        isCurrencyUncertain: false,
        currencyConfidenceNote: 'Explicit ₹ and Indian GSTIN verified.',
        appliedExchangeRate: 1.0,
        exchangeRateSource: 'Direct INR transaction (No conversion applied)',
        isForeignCurrency: false,
        subtotal: 1250.0,
        taxes: [
          { id: 'tax-1', name: 'CGST 2.5%', ratePercent: 2.5, amount: 31.25, isUncertain: false },
          { id: 'tax-2', name: 'SGST 2.5%', ratePercent: 2.5, amount: 31.25, isUncertain: false },
        ],
        totalTax: 62.5,
        discount: 25.0,
        tipOrGratuity: 0,
        totalAmount: 1287.5,
        inrSubtotal: 1250.0,
        inrTotalTax: 62.5,
        inrTotalAmount: 1287.5,
        items: [
          {
            id: 'item-1',
            description: 'Tata Sampann Unpolished Toor Dal (1kg)',
            quantity: 2,
            unitPrice: 165.0,
            lineTotal: 330.0,
            category: 'Groceries',
            isUncertain: false,
          },
          {
            id: 'item-2',
            description: 'Fortune Sunlite Sunflower Oil (1L)',
            quantity: 2,
            unitPrice: 145.0,
            lineTotal: 290.0,
            category: 'Groceries',
            isUncertain: false,
          },
          {
            id: 'item-3',
            description: 'Amul Butter Salted (500g)',
            quantity: 1,
            unitPrice: 285.0,
            lineTotal: 285.0,
            category: 'Dairy',
            isUncertain: false,
          },
          {
            id: 'item-4',
            description: 'Basmati Rice Premium (2kg)',
            quantity: 1,
            unitPrice: 345.0,
            lineTotal: 345.0,
            category: 'Groceries',
            isUncertain: true,
            uncertaintyReason: 'Weight imprint slightly faded on receipt line',
          },
        ],
        missingFields: [],
        reviewAlerts: ['One line item has faded weight info; please verify Basmati Rice quantity.'],
        overallConfidence: 'HIGH',
        userNotes: 'Weekly grocery pantry restocking.',
        status: 'draft',
      };
    } else if (type === 'restaurant') {
      sample = {
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        merchantName: 'Cafe Madras & Dosa Bar',
        merchantAddress: 'Matunga Circle, Mumbai, Maharashtra 400019',
        merchantPhone: '+91 22 2401 4419',
        merchantGstin: '27AAMCD4512N1ZQ',
        invoiceNumber: 'CMD-5542',
        date: '2026-11-05',
        time: '08:30',
        paymentMethod: 'Cash',
        detectedCurrency: 'INR',
        detectedCurrencySymbol: '₹',
        isCurrencyUncertain: false,
        currencyConfidenceNote: 'Printed ₹ symbols and 5% Restaurant GST rate.',
        appliedExchangeRate: 1.0,
        exchangeRateSource: 'Direct INR transaction (No conversion applied)',
        isForeignCurrency: false,
        subtotal: 620.0,
        taxes: [
          { id: 'tax-1', name: 'CGST 2.5%', ratePercent: 2.5, amount: 15.5, isUncertain: false },
          { id: 'tax-2', name: 'SGST 2.5%', ratePercent: 2.5, amount: 15.5, isUncertain: false },
        ],
        totalTax: 31.0,
        discount: 0,
        tipOrGratuity: 30.0,
        totalAmount: 681.0,
        inrSubtotal: 620.0,
        inrTotalTax: 31.0,
        inrTotalAmount: 681.0,
        items: [
          {
            id: 'item-1',
            description: 'Butter Masala Dosa with Podi',
            quantity: 2,
            unitPrice: 140.0,
            lineTotal: 280.0,
            category: 'Dining',
            isUncertain: false,
          },
          {
            id: 'item-2',
            description: 'Filter Coffee (Degree)',
            quantity: 3,
            unitPrice: 50.0,
            lineTotal: 150.0,
            category: 'Beverages',
            isUncertain: false,
          },
          {
            id: 'item-3',
            description: 'Medu Vada (Pair)',
            quantity: 2,
            unitPrice: 95.0,
            lineTotal: 190.0,
            category: 'Dining',
            isUncertain: false,
          },
        ],
        missingFields: [],
        reviewAlerts: [],
        overallConfidence: 'HIGH',
        userNotes: 'Breakfast meeting with client team.',
        status: 'draft',
      };
    } else {
      // Foreign USD bill
      sample = {
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        merchantName: 'Blue Bottle Coffee Roasters',
        merchantAddress: 'San Francisco, CA 94103, USA',
        merchantPhone: '+1 (415) 252-7735',
        merchantGstin: '',
        invoiceNumber: 'BBC-90412',
        date: '2026-11-01',
        time: '11:15',
        paymentMethod: 'Credit Card (Mastercard)',
        detectedCurrency: 'USD',
        detectedCurrencySymbol: '$',
        isCurrencyUncertain: false,
        currencyConfidenceNote: 'Printed USD $ currency symbols with California state tax.',
        appliedExchangeRate: 86.85,
        exchangeRateSource: 'Reserve Bank of India (RBI) Reference Benchmark ($1 = ₹86.85)',
        isForeignCurrency: true,
        subtotal: 24.5,
        taxes: [
          { id: 'tax-us-1', name: 'SF City Tax 8.625%', ratePercent: 8.625, amount: 2.11, isUncertain: false },
        ],
        totalTax: 2.11,
        discount: 0,
        tipOrGratuity: 3.5,
        totalAmount: 30.11,
        inrSubtotal: 2127.83,
        inrTotalTax: 183.25,
        inrTotalAmount: 2615.05,
        items: [
          {
            id: 'item-1',
            description: 'Hayes Valley Espresso Whole Bean (12oz)',
            quantity: 1,
            unitPrice: 18.0,
            lineTotal: 18.0,
            category: 'Groceries',
            isUncertain: false,
          },
          {
            id: 'item-2',
            description: 'Oat Milk Gibraltar',
            quantity: 1,
            unitPrice: 6.5,
            lineTotal: 6.5,
            category: 'Dining',
            isUncertain: false,
          },
        ],
        missingFields: ['GSTIN (International Merchant)'],
        reviewAlerts: [
          'Foreign Currency Detected: USD ($). Converted to Indian Rupees (INR) at rate $1 = ₹86.85 via RBI reference rate.',
        ],
        overallConfidence: 'HIGH',
        userNotes: 'Travel expense receipt claim.',
        status: 'draft',
      };
    }

    onAnalysisComplete(sample);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Intro Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Receipt Intelligence &bull; Gemini Flash Lite</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Scan, Verify &amp; Analyze Receipts in <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Indian Rupees</span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Snap a receipt or upload a bill. Gemini extracts merchant details, dates, itemized lines, and GST tax breakdowns with zero guesswork. Foreign currencies are automatically flagged and converted to INR via reliable RBI benchmark exchange rates.
          </p>
        </div>
      </div>

      {/* Camera Modal / Live View */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in">
          {/* Camera Header */}
          <div className="w-full max-w-xl flex items-center justify-between text-white pb-2">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold">Align Receipt in Frame</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={flipCamera}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
                title="Flip Camera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
              <button
                onClick={stopCameraStream}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
                title="Close Camera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Camera Viewport with Reticle Overlay */}
          <div className="relative w-full max-w-xl flex-1 max-h-[70vh] rounded-3xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Receipt Alignment Frame overlay */}
            <div className="absolute inset-8 sm:inset-12 border-2 border-emerald-400/60 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between items-start">
                <span className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl"></span>
                <span className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr"></span>
              </div>
              <p className="text-center text-xs font-medium text-emerald-300/90 bg-slate-950/70 py-1 px-3 rounded-full self-center backdrop-blur-sm">
                Ensure good lighting &bull; Keep text flat
              </p>
              <div className="flex justify-between items-end">
                <span className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl"></span>
                <span className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br"></span>
              </div>
            </div>
          </div>

          {/* Camera Controls */}
          <div className="w-full max-w-xl flex items-center justify-center pt-4 pb-2">
            <button
              onClick={capturePhoto}
              className="w-18 h-18 rounded-full bg-white p-1 shadow-2xl hover:scale-105 active:scale-95 transition flex items-center justify-center"
            >
              <div className="w-15 h-15 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs for mobile & file upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Loading state indicator during AI analysis */}
      {isAnalyzing && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center space-y-6 shadow-2xl animate-pulse">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin flex items-center justify-center">
              <span className="text-2xl font-bold text-emerald-400">₹</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Analyzing Receipt with Gemini Flash Lite</h3>
            <p className="text-sm text-emerald-400 font-medium">{analysisStep}</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Extracting merchant, items, GST rates, subtotal, and verifying Indian Rupee currency. Uncertain fields are explicitly flagged without guessing.
            </p>
          </div>

          <div className="w-full max-w-xs mx-auto bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full w-3/4 animate-pulse rounded-full"></div>
          </div>
        </div>
      )}

      {/* Error Message Box */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm flex-1">
            <h4 className="font-semibold text-rose-300">Extraction Error</h4>
            <p className="text-xs text-rose-200/90 leading-relaxed">{errorMessage}</p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setErrorMessage(null)}
                className="text-xs font-semibold underline text-rose-300 hover:text-white"
              >
                Dismiss
              </button>
              <button
                onClick={() => loadDemoReceipt('supermarket')}
                className="text-xs font-semibold text-emerald-400 hover:underline"
              >
                Try sample Indian grocery receipt instead &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Upload / Camera Cards */}
      {!isAnalyzing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Camera Card */}
          <div
            onClick={() => {
              startCamera();
            }}
            className="group cursor-pointer rounded-3xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 flex flex-col items-center text-center justify-center space-y-4 transition shadow-lg hover:shadow-emerald-950/30 active:scale-[0.99]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                <span>Capture with Camera</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Use your smartphone or webcam to photograph bills or cash memos directly.
              </p>
            </div>

            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              Open Camera Viewport &rarr;
            </span>
          </div>

          {/* Upload / Drag and Drop Card */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group cursor-pointer rounded-3xl bg-slate-900/90 hover:bg-slate-900 border p-6 flex flex-col items-center text-center justify-center space-y-4 transition shadow-lg active:scale-[0.99] ${
              dragActive
                ? 'border-emerald-400 bg-emerald-950/20 ring-2 ring-emerald-500/30'
                : 'border-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:scale-110 transition group-hover:text-emerald-400">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Upload Receipt File</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Drag and drop your receipt image here, or browse files from your computer or phone.
              </p>
            </div>

            <span className="text-xs text-slate-500 font-medium">Supports JPG, PNG, WEBP</span>
          </div>
        </div>
      )}

      {/* Quick Test Demo Receipts Section */}
      {!isAnalyzing && (
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Instant Test Receipts (No upload needed):</span>
            </div>
            <span className="text-[11px] text-slate-500">Test currency review &amp; editable flows</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => loadDemoReceipt('supermarket')}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition text-xs group"
            >
              <div>
                <p className="font-semibold text-slate-200 group-hover:text-emerald-300">
                  More Supermarket Bill
                </p>
                <p className="text-[11px] text-slate-400">INR &bull; 4 Items &bull; GST Breakdown</p>
              </div>
              <span className="font-bold text-emerald-400 text-xs">₹1,287.50</span>
            </button>

            <button
              onClick={() => loadDemoReceipt('restaurant')}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition text-xs group"
            >
              <div>
                <p className="font-semibold text-slate-200 group-hover:text-emerald-300">
                  Cafe Madras &amp; Dosa
                </p>
                <p className="text-[11px] text-slate-400">INR &bull; Dining &bull; CGST/SGST 5%</p>
              </div>
              <span className="font-bold text-emerald-400 text-xs">₹681.00</span>
            </button>

            <button
              onClick={() => loadDemoReceipt('foreign')}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-left transition text-xs group"
            >
              <div>
                <p className="font-semibold text-slate-200 group-hover:text-amber-300">
                  Blue Bottle SF (Foreign)
                </p>
                <p className="text-[11px] text-slate-400">USD $30.11 &bull; RBI Converted</p>
              </div>
              <span className="font-bold text-amber-400 text-xs">₹2,615.05</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
