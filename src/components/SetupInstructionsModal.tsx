import React from 'react';
import { ShieldCheck, Lock, Server, Cloud, Code, Terminal, CheckCircle2, X } from 'lucide-react';

interface SetupInstructionsModalProps {
  onClose: () => void;
}

export const SetupInstructionsModal: React.FC<SetupInstructionsModalProps> = ({ onClose }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in">
      {/* Top Banner */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Security Architecture &amp; Production Setup</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Securing the Gemini API Key &amp; Server Proxy
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          To protect sensitive billing data and avoid credential leakage, the application keeps the <strong>GEMINI_API_KEY</strong> completely out of client-side JavaScript. All extraction calls run through a backend proxy server using <strong>@google/genai</strong>.
        </p>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">No Client-Side Keys</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Browsers never see or store the Gemini API key. Requests are signed strictly inside server-side Node.js environment.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Express Backend Proxy</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The <code className="text-emerald-400 font-mono">/api/receipt/analyze</code> endpoint enforces payload limits (35MB) and strict JSON schema output.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">PWA Offline Safety</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Service Worker caches static assets and previously verified receipts in IndexedDB/LocalStorage for offline browsing.
          </p>
        </div>
      </div>

      {/* Code Snippets & Deployment Guide */}
      <div className="space-y-4">
        {/* Step 1: Environment Variables */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>1. Configuring Environment Secrets (.env)</span>
          </h3>
          <p className="text-xs text-slate-400">
            In development and in Google AI Studio, the key is provided via your project&apos;s Secrets manager. Locally, create a <code className="text-emerald-400 font-mono">.env</code> file:
          </p>
          <div className="rounded-xl bg-slate-950 p-3 font-mono text-xs text-emerald-300 border border-slate-800">
            <code>GEMINI_API_KEY=&quot;AIzaSy...Your_Secure_Key_Here&quot;</code><br />
            <code>PORT=3000</code><br />
            <code>NODE_ENV=development</code>
          </div>
        </div>

        {/* Step 2: Serverless Function Pattern (Vercel / Netlify) */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span>2. Serverless Function Implementation (e.g. Next.js / Vercel api/receipt.ts)</span>
          </h3>
          <p className="text-xs text-slate-400">
            If migrating to a serverless platform, you can convert the Express route into a standalone edge or serverless handler:
          </p>
          <pre className="rounded-xl bg-slate-950 p-4 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto">
{`import { GoogleGenAI, Type } from '@google/genai';

export async function POST(req: Request) {
  const { imageBase64, mimeType } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
        { text: 'Extract receipt items strictly adhering to JSON schema. Amounts in INR or convert with RBI rates.' }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: { /* Defined schema */ }
    }
  });

  return new Response(response.text, {
    headers: { 'Content-Type': 'application/json' }
  });
}`}
          </pre>
        </div>

        {/* Step 3: Deployment Checklist */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>3. Production Deployment Checklist</span>
          </h3>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span><strong>Google Cloud Run</strong>: Containerized with Node 20+, port 3000, environment secret mounted.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span><strong>PWA Compliance</strong>: Valid Service Worker, HTTPS, 192px/512px icons, Web App Manifest.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span><strong>Data Privacy</strong>: Receipt images are processed in-memory and never written to permanent disk on the server.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
