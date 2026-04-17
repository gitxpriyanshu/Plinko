'use client';

import { useState, useRef, Suspense, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PlinkoBoard, { PlinkoBoardRef } from '@/components/PlinkoBoard';

interface VerifyResult {
   commitHex: string;
   combinedSeed: string;
   pegMapHash: string;
   binIndex: number;
   pathString?: string;
   isValid: boolean | null;
   message?: string;
   match?: boolean;
   checks?: {
      commitMatch: boolean;
      combinedSeedMatch: boolean;
      pegMapMatch: boolean;
      binMatch: boolean;
   };
}

function CopyButton({ text }: { text: string }) {
   const [copied, setCopied] = useState(false);
   const handleCopy = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!text) return;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };
   return (
      <button 
         type="button" 
         onClick={handleCopy}
         className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] uppercase tracking-wider font-bold bg-white/10 hover:bg-primary/40 text-gray-300 hover:text-white rounded transition-colors z-10"
      >
         {copied ? 'Copied!' : 'Copy'}
      </button>
   );
}

function VerifyForm() {
   const searchParams = useSearchParams();

   const [serverSeed, setServerSeed] = useState(searchParams.get('serverSeed') || '');
   const [clientSeed, setClientSeed] = useState(searchParams.get('clientSeed') || '');
   const [nonce, setNonce] = useState(searchParams.get('nonce') || '');
   const [dropColumn, setDropColumn] = useState(searchParams.get('dropColumn') || '6');
   const [roundId, setRoundId] = useState(searchParams.get('roundId') || '');

   const [results, setResults] = useState<VerifyResult | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);
   const [hasPath, setHasPath] = useState(false);
   const [lastPath, setLastPath] = useState<('L' | 'R')[]>([]);
   const [lastBinIndex, setLastBinIndex] = useState<number>(-1);
   const [baseUrl, setBaseUrl] = useState('');

   useEffect(() => {
       if (typeof window !== 'undefined') {
           // Using the production domain from README to ensure the link is 'real' even in local development
           setBaseUrl('https://plinko-flax.vercel.app');
       }
   }, []);

   // Replay
   const boardRef = useRef<PlinkoBoardRef>(null);

   const performVerification = useCallback(async (
      sSeed: string, 
      cSeed: string, 
      n: string, 
      dc: string, 
      rId?: string
   ) => {
      setLoading(true);
      setError('');
      setResults(null);
      setHasPath(false);

      try {
         const qs = new URLSearchParams();
         qs.append('serverSeed', sSeed);
         qs.append('clientSeed', cSeed);
         qs.append('nonce', n);
         qs.append('dropColumn', dc);
         if (rId) qs.append('roundId', rId);

         const res = await fetch(`/api/verify?${qs.toString()}`);
         const data = await res.json();

         if (!res.ok) {
            setError(data.error || 'Failed to verify');
            setLoading(false);
            return;
         }

         setResults(data);

         if (rId) {
            try {
               const roundRes = await fetch(`/api/rounds/${rId}`);
               if (roundRes.status !== 404) {
                 const roundData = await roundRes.json();
                 
                 if (roundData.pathJson) {
                    const parsedPath = typeof roundData.pathJson === 'string'
                       ? JSON.parse(roundData.pathJson)
                       : roundData.pathJson;
                    setHasPath(true);
                    setLastPath(parsedPath);
                    setLastBinIndex(data.binIndex);
                    setTimeout(() => boardRef.current?.triggerDrop(parsedPath, data.binIndex), 50);
                 } else {
                    setLastPath([]);
                    setLastBinIndex(data.binIndex);
                    setTimeout(() => boardRef.current?.triggerDrop([], data.binIndex), 50);
                 }
               }
            } catch {
               setLastBinIndex(data.binIndex);
               setLastPath([]);
               setTimeout(() => boardRef.current?.triggerDrop([], data.binIndex), 50);
            }
         } else {
            setLastBinIndex(data.binIndex);
            setLastPath([]);
            setTimeout(() => boardRef.current?.triggerDrop([], data.binIndex), 50);
         }
      } catch {
         setError('Network error during verification.');
      }
      setLoading(false);
   }, []);

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      performVerification(serverSeed, clientSeed, nonce, dropColumn, roundId);
   };

    // Initial Auto-Fill and Auto-Verify logic
    useEffect(() => {
      const currentServerSeed = searchParams.get('serverSeed') || '';
      const currentClientSeed = searchParams.get('clientSeed') || '';
      const currentNonce = searchParams.get('nonce') || '';
      const currentDropColumn = searchParams.get('dropColumn') || '';
      const currentRoundId = searchParams.get('roundId') || '';

      // Sync state with URL params
      if (currentServerSeed) setServerSeed(currentServerSeed);
      if (currentClientSeed) setClientSeed(currentClientSeed);
      if (currentNonce) setNonce(currentNonce);
      if (currentDropColumn) setDropColumn(currentDropColumn);
      if (currentRoundId) setRoundId(currentRoundId);

      const run = async () => {
        let finalServerSeed = currentServerSeed;
        let finalClientSeed = currentClientSeed;
        let finalNonce = currentNonce;
        let finalDropColumn = currentDropColumn;

        // Fallback: If only roundId is provided, fetch missing seeds
        if (currentRoundId && (!finalServerSeed || !finalClientSeed)) {
          try {
            const res = await fetch(`/api/rounds/${currentRoundId}`);
            if (res.ok) {
              const data = await res.json();
              finalServerSeed = finalServerSeed || data.serverSeed || '';
              finalClientSeed = finalClientSeed || data.clientSeed || '';
              finalNonce = finalNonce || data.nonce || '';
              finalDropColumn = finalDropColumn || data.dropColumn?.toString() || '';
              
              setServerSeed(finalServerSeed);
              setClientSeed(finalClientSeed);
              setNonce(finalNonce);
              setDropColumn(finalDropColumn);
            }
          } catch (e) {
            console.error("Auto-fetch failed", e);
          }
        }

        // Auto-Verify if everything is present
        if (finalServerSeed && finalClientSeed && finalNonce && finalDropColumn) {
          performVerification(finalServerSeed, finalClientSeed, finalNonce, finalDropColumn, currentRoundId);
        }
      };
      run();
    }, [searchParams, performVerification]);

   const permalink = baseUrl
      ? `${baseUrl}/verify?serverSeed=${encodeURIComponent(serverSeed)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${encodeURIComponent(nonce)}&dropColumn=${encodeURIComponent(dropColumn)}${roundId ? `&roundId=${encodeURIComponent(roundId)}` : ''}`
      : '';

   const copyLink = () => {
      if (!permalink) return;
      navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };

   return (
      <main className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 pb-10">
         <div className="flex-1 flex flex-col gap-6">

            {/* Input Form */}
            <div className="glass p-6 md:p-8 rounded-3xl shadow-xl border border-white/5">
               <h2 className="text-2xl font-bold mb-6 tracking-tight">Verify Dropped Round</h2>
               <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest relative">
                        Server Seed
                        <div className="relative flex">
                           <input required type="text" aria-label="Server Seed Input" value={serverSeed} onChange={e => setServerSeed(e.target.value)} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none font-mono text-gray-200 transition-all font-bold pr-16" placeholder="Enter server seed" />
                           {serverSeed && <CopyButton text={serverSeed} />}
                        </div>
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest relative">
                        Client Seed
                        <div className="relative flex">
                           <input required type="text" aria-label="Client Seed Input" value={clientSeed} onChange={e => setClientSeed(e.target.value)} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none font-mono text-gray-200 transition-all font-bold pr-16" placeholder="Enter client seed" />
                           {clientSeed && <CopyButton text={clientSeed} />}
                        </div>
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Nonce
                        <input required type="text" aria-label="Nonce Input" value={nonce} onChange={e => setNonce(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none font-mono text-gray-200 transition-all font-bold" placeholder="e.g. 1" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Drop Column (0-12)
                        <input required type="number" aria-label="Drop Column Selector" min="0" max="12" value={dropColumn} onChange={e => setDropColumn(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none font-mono text-gray-200 transition-all font-bold" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest md:col-span-2 relative p-4 bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden">
                        <span className="flex justify-between items-center z-10 relative">
                           Round ID Database Link
                           <span className="font-normal text-gray-400 normal-case">(Optional Check)</span>
                        </span>
                        <input type="text" aria-label="Round ID Input" value={roundId} onChange={e => setRoundId(e.target.value)} className="mt-2 px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none font-mono text-gray-200 transition-all z-10 relative" placeholder="Provides matching validation + graphical replay" />
                     </label>
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-4 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-lg">
                     {loading ? 'Crunching Numbers...' : 'Verify Fairness'}
                  </button>
                  {error && <div className="text-red-500 text-sm mt-1 font-bold text-center bg-red-500/10 py-3 rounded-lg border border-red-500/20">{error}</div>}
               </form>
            </div>

            {/* Educational Collapsible */}
            <details className="glass rounded-3xl group overflow-hidden border border-white/5">
               <summary className="font-bold cursor-pointer outline-none p-6 text-lg hover:bg-white/5 transition-colors select-none">
                  How does Provably Fair actually work?
               </summary>
               <div className="p-6 pt-0 text-sm text-gray-300 space-y-4 border-t border-white/5 pt-4 bg-black/20">
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">1</strong>
                     <span>Server commits to a secret by generating a <code>serverSeed</code> and sharing its hash (<code>commitHex</code>) before the round begins.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">2</strong>
                     <span>Player provides their own <code>clientSeed</code>.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">3</strong>
                     <span>Both values are combined to generate a deterministic random seed.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">4</strong>
                     <span>The game result is generated using this seed.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">5</strong>
                     <span>After the round, server reveals the original <code>serverSeed</code>.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">6</strong>
                     <span>Anyone can verify the result using these values.</span>
                  </p>
               </div>
            </details>

            {/* Computation Trace Block */}
            {results && (
                <div className="glass p-6 md:p-8 rounded-3xl shadow-xl border border-white/5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-xl font-bold tracking-tight mb-2">Computation Trace</h2>
                    
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">1</div>
                        <div className="flex-1 space-y-2">
                           <div className="text-sm font-bold text-gray-200">Commit Hex Validation</div>
                           <div className="text-[10px] text-gray-400">Prove that the server committed to a secret seed before the round started by comparing its hash.</div>
                           <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] break-all overflow-hidden text-primary/80">
                               {`SHA256("${serverSeed}:${nonce}")`}<br/>
                               <span className="text-gray-300 mt-1 block">→ {results.commitHex}</span>
                           </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">2</div>
                        <div className="flex-1 space-y-2">
                           <div className="text-sm font-bold text-gray-200">Master Seed Generation</div>
                           <div className="text-[10px] text-gray-400">Combine all seeds securely to build an unpredictable physics starting state.</div>
                           <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] break-all overflow-hidden text-primary/80">
                               {`SHA256("${serverSeed}:${clientSeed}:${nonce}")`}<br/>
                               <span className="text-gray-300 mt-1 block">→ {results.combinedSeed}</span>
                           </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">3</div>
                        <div className="flex-1 space-y-2">
                           <div className="text-sm font-bold text-gray-200">Mathematical Initialization (PRNG)</div>
                           <div className="text-[10px] text-gray-400">Translate the combined hash into a mathematically stable Xorshift32 PRNG state generator.</div>
                           <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] break-all overflow-hidden text-primary/80">
                               {`makeXorshift32( seedFromHex("${results.combinedSeed?.substring(0,8) || ''}...") )`}
                           </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">4</div>
                        <div className="flex-1 space-y-2">
                           <div className="text-sm font-bold text-gray-200">Map Trajectory Serialization</div>
                           <div className="text-[10px] text-gray-400">Generate precisely 78 Peg biases natively using the PRNG and stringify them logically.</div>
                           <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] break-all overflow-hidden text-primary/80">
                               getPegMapHash( generatePegMap(rand, 12) )<br/>
                               <span className="text-gray-300 mt-1 block">→ {results.pegMapHash}</span>
                           </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.1)]">5</div>
                        <div className="flex-1 space-y-2">
                           <div className="text-sm font-bold text-gray-200">Physics Simulation Limits</div>
                           <div className="text-[10px] text-gray-400">Execute deterministic physics drops using the precise map and continuing PRNG sequences.</div>
                           <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] break-all overflow-hidden text-primary/80">
                               {`simulateDrop( pegMap, rand, ${dropColumn}, 12 )`}<br/>
                               {results.pathString && <span className="text-gray-300 mt-1 block">→ Path: {results.pathString}</span>}
                               <span className="text-white font-bold block mt-1">→ Bin Index: {results.binIndex}</span>
                           </div>
                        </div>
                    </div>
                </div>
            )}>
         </div>

         <div className="w-full lg:w-[480px] flex flex-col gap-6">

            {/* Results Data Table */}
            {results && (
               <div className={`glass p-6 md:p-8 rounded-3xl border relative overflow-hidden shadow-2xl transition-all duration-500 ${
                  results.isValid === true ? 'border-green-500/30' : 
                  results.isValid === false ? 'border-red-500/30' : 
                  'border-amber-500/30'
               }`}>
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                     results.isValid === true ? 'bg-green-500' : 
                     results.isValid === false ? 'bg-red-500' : 
                     'bg-amber-500'
                  }`} />
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                     {results.isValid === true && <span className="text-green-500 text-lg">✅</span>}
                     {results.isValid === false && <span className="text-red-500 text-lg">❌</span>}
                     {results.isValid === null && <span className="text-amber-500 text-lg">⚠️</span>}
                     {results.isValid === null ? 'Simulation Logic' : 'Verified Logic'}
                  </h3>
                  <p className="text-[10px] text-gray-500 mb-6 italic">
                     {results.isValid === null 
                        ? "Simulation Mode — Results are computed deterministically from inputs but NOT verified against any real game round."
                        : "Verified Mode — These values are recomputed and verified against the official server record."
                     }
                  </p>

                  <div className="space-y-4 text-sm break-all font-mono">
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5 relative pr-16">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-500 uppercase tracking-widest text-[10px]">Computed Commit Hex</span>
                          <span className="text-[9px] text-primary/60 font-sans font-bold">SHA256(S:N)</span>
                        </div>
                        <span className="text-gray-200">{results.commitHex}</span>
                        <CopyButton text={results.commitHex} />
                     </div>
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5 relative pr-16">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-500 uppercase tracking-widest text-[10px]">Computed Combined Seed</span>
                          <span className="text-[9px] text-primary/60 font-sans font-bold">SHA256(S:C:N)</span>
                        </div>
                        <span className="text-primary font-bold">{results.combinedSeed}</span>
                        <CopyButton text={results.combinedSeed} />
                     </div>
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5 relative">
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-gray-500 uppercase tracking-widest text-[10px]">Simulated Peg Map Hash</span>
                           <span className="text-[9px] text-primary/60 font-sans font-bold">Peg Map Hash (SHA256)</span>
                         </div>
                        <span className="text-gray-200">{results.pegMapHash}</span>
                     </div>
                     {results.pathString && (
                        <div className="bg-black/40 p-4 rounded-xl border border-primary/20 flex flex-col justify-between shadow-inner gap-2">
                           <div className="flex justify-between items-center w-full">
                              <span className="text-gray-400 uppercase tracking-widest text-xs font-bold font-sans">Trajectory Path Sequence</span>
                              <span className="text-[9px] text-primary/60 font-sans font-bold">12 Drops Logged</span>
                           </div>
                           <span className="text-white text-lg font-mono font-bold tracking-widest text-center border-t border-white/10 pt-2 flex gap-1 justify-center whitespace-nowrap overflow-hidden">
                              {results.pathString.split('').map((char, index) => (
                                 <span key={index} className={`w-8 h-8 flex items-center justify-center rounded-md ${char === 'L' ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}>{char}</span>
                              ))}
                           </span>
                        </div>
                     )}
                     <div className={`p-4 rounded-xl border flex items-center justify-between shadow-inner transition-colors duration-500 ${
                        results.isValid === true ? 'bg-green-500/10 border-green-500/30' : 
                        results.isValid === false ? 'bg-red-500/10 border-red-500/30' : 
                        'bg-amber-500/10 border-amber-500/30'
                     }`}>
                        <span className="text-gray-400 uppercase tracking-widest text-xs font-bold font-sans">Final Trajectory Bin</span>
                        <span className={`text-3xl font-bold font-sans px-4 py-1 rounded-lg border transition-colors duration-500 ${
                           results.isValid === true ? 'text-green-400 bg-green-500/20 border-green-500/30' : 
                           results.isValid === false ? 'text-red-400 bg-red-500/20 border-red-500/30' : 
                           'text-amber-500 bg-amber-500/20 border-amber-500/30'
                        }`}>{results.binIndex}</span>
                     </div>

                     <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-3">
                        {results.isValid === true ? (
                           <div className="flex-1 bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-green-400 flex flex-col items-center justify-center gap-1 font-sans font-extrabold shadow-lg animate-in zoom-in-95 duration-300">
                              <div className="flex items-center gap-2 text-xl">
                                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                MATCH VERIFIED
                              </div>
                              <span className="text-[10px] uppercase tracking-widest opacity-60">Cryptographic Proof Valid</span>
                           </div>
                        ) : results.isValid === false ? (
                           <div className="flex-1 bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-500 flex flex-col items-center justify-center gap-1 font-sans font-extrabold shadow-lg animate-in zoom-in-95 duration-300">
                              <div className="flex items-center gap-2 text-xl">
                                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                MISMATCH DETECTED
                              </div>
                              <span className="text-[10px] uppercase tracking-widest opacity-60">Simulation Data Conflict</span>
                              
                              {results.checks && (
                                 <div className="w-full mt-3 p-3 bg-red-950/30 rounded-lg text-xs font-mono text-left border border-red-500/20">
                                    <ul className="space-y-1">
                                       <li className={results.checks.commitMatch ? "text-green-400" : "text-red-400"}>
                                          {`[${results.checks.commitMatch ? "✓" : "✗"}] Commit Hash (S:N)`}
                                       </li>
                                       <li className={results.checks.combinedSeedMatch ? "text-green-400" : "text-red-400"}>
                                          {`[${results.checks.combinedSeedMatch ? "✓" : "✗"}] Combined Seed (S:C:N)`}
                                       </li>
                                       <li className={results.checks.pegMapMatch ? "text-green-400" : "text-red-400"}>
                                          {`[${results.checks.pegMapMatch ? "✓" : "✗"}] Peg Map Uniformity`}
                                       </li>
                                       <li className={results.checks.binMatch ? "text-green-400" : "text-red-400"}>
                                          {`[${results.checks.binMatch ? "✓" : "✗"}] Final Bin Index`}
                                       </li>
                                    </ul>
                                 </div>
                              )}
                           </div>
                        ) : (
                           <div className="flex-1 bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-500 flex flex-col items-center justify-center gap-2 font-sans font-extrabold shadow-lg animate-in zoom-in-95 duration-300 text-center">
                              <div className="flex items-center gap-2 text-xl">
                                <span className="text-xl">⚠️</span>
                                SIMULATION MODE
                              </div>
                              <span className="text-[10px] uppercase tracking-widest opacity-70">Not a verified game result</span>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Permalink Copy */}
                  {baseUrl && (
                    <div className="mt-8 flex flex-col gap-2">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-1">Share Proof Permalink</span>
                       <div className={`flex bg-black/50 border rounded-xl overflow-hidden transition-all duration-500 ${
                          results.isValid === true ? 'border-green-500/30 ring-green-500/10' : 
                          results.isValid === false ? 'border-red-500/30 ring-red-500/10' : 
                          'border-amber-500/30 ring-amber-500/10'
                       } focus-within:ring-1`}>
                          <input readOnly value={permalink} className="bg-transparent flex-1 px-4 py-3 text-xs outline-none opacity-80" />
                          <button onClick={copyLink} className={`px-6 transition-colors font-bold text-white text-sm ${
                             results.isValid === true ? 'bg-green-600 hover:bg-green-700' : 
                             results.isValid === false ? 'bg-red-600 hover:bg-red-700' : 
                             'bg-amber-600 hover:bg-amber-700'
                          }`}>
                             {copied ? 'Copied!' : 'Copy'}
                          </button>
                       </div>
                    </div>
                  )}
               </div>
            )}

            {/* Dynamic Mini Replay Viewer */}
            <div className={`glass p-6 md:p-8 rounded-3xl border border-white/5 flex flex-col items-center transition-all duration-500 ease-in-out shadow-lg relative ${!results ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
               <div className="w-full flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Mini Replay</h3>
                  <div className="flex gap-2 items-center">
                    {results && !hasPath && (
                       <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">No Path Data</span>
                    )}
                    {results && (
                      <button 
                        onClick={() => boardRef.current?.triggerDrop(lastPath, lastBinIndex)}
                        aria-label="Replay Animation"
                        className="px-3 py-1 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/20 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        REPLAY
                      </button>
                    )}
                  </div>
               </div>

               <div className="w-full max-w-[400px] flex justify-center bg-black/20 rounded-2xl border border-white/5 p-4 shadow-inner">
                  <PlinkoBoard
                     ref={boardRef}
                     pegMap={null}
                     dropColumn={Number(dropColumn) || 6}
                     reducedMotion={!hasPath}
                     muted={true}
                  />
               </div>
            </div>
         </div>
      </main>
   );
}

export default function VerifyPage() {
   return (
      <div className="min-h-screen p-4 md:p-8 bg-transparent">
         <header className="max-w-6xl mx-auto flex justify-between items-center mb-10 px-4 border-b border-white/10 pb-6 pt-2">
            <h1 className="text-3xl md:text-4xl font-extrabold gradient-text tracking-tight">Provably Fair Verifier</h1>
            <Link href="/" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold text-gray-300 transition-colors border border-white/10">
               ← Back to Game
            </Link>
         </header>

         <Suspense fallback={<div className="p-12 text-center glass max-w-6xl mx-auto rounded-3xl animate-pulse font-bold tracking-widest uppercase text-gray-400 border border-white/5">Loading Verification Core...</div>}>
            <VerifyForm />
         </Suspense>
      </div>
   );
}
