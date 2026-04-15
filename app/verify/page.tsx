'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PlinkoBoard, { PlinkoBoardRef } from '@/components/PlinkoBoard';

function VerifyForm() {
   const searchParams = useSearchParams();

   const [serverSeed, setServerSeed] = useState(searchParams.get('serverSeed') || '');
   const [clientSeed, setClientSeed] = useState(searchParams.get('clientSeed') || '');
   const [nonce, setNonce] = useState(searchParams.get('nonce') || '');
   const [dropColumn, setDropColumn] = useState(searchParams.get('dropColumn') || '6');
   const [roundId, setRoundId] = useState(searchParams.get('roundId') || '');

   const [results, setResults] = useState<any>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);
   const [hasPath, setHasPath] = useState(false);

   // Replay
   const boardRef = useRef<PlinkoBoardRef>(null);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setResults(null);
      setHasPath(false);

      try {
         const qs = new URLSearchParams();
         qs.append('serverSeed', serverSeed);
         qs.append('clientSeed', clientSeed);
         qs.append('nonce', nonce);
         qs.append('dropColumn', dropColumn);
         if (roundId) qs.append('roundId', roundId);

         const res = await fetch(`/api/verify?${qs.toString()}`);
         const data = await res.json();

         if (!res.ok) {
            setError(data.error || 'Failed to verify');
            setLoading(false);
            return;
         }

         setResults(data);

         if (roundId) {
            try {
               const roundRes = await fetch(`/api/rounds/${roundId}`);
               const roundData = await roundRes.json();

               if (roundData && roundData.pathJson) {
                  const parsedPath = typeof roundData.pathJson === 'string'
                     ? JSON.parse(roundData.pathJson)
                     : roundData.pathJson;
                  setHasPath(true);

                  setTimeout(() => {
                     boardRef.current?.triggerDrop(parsedPath, data.binIndex);
                  }, 50);
               } else {
                  setTimeout(() => {
                     boardRef.current?.triggerDrop([], data.binIndex);
                  }, 50);
               }
            } catch (err) {
               console.error("Failed to fetch round path", err);
               setTimeout(() => {
                  boardRef.current?.triggerDrop([], data.binIndex);
               }, 50);
            }
         } else {
            setTimeout(() => {
               boardRef.current?.triggerDrop([], data.binIndex);
            }, 50);
         }

      } catch (err) {
         setError('Network error during verification.');
      }
      setLoading(false);
   };

   const permalink = typeof window !== 'undefined'
      ? `${window.location.origin}/verify?serverSeed=${encodeURIComponent(serverSeed)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${encodeURIComponent(nonce)}&dropColumn=${encodeURIComponent(dropColumn)}${roundId ? `&roundId=${encodeURIComponent(roundId)}` : ''}`
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
                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Server Seed
                        <input required type="text" value={serverSeed} onChange={e => setServerSeed(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-gray-200 transition-all" placeholder="Enter server seed" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Client Seed
                        <input required type="text" value={clientSeed} onChange={e => setClientSeed(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-gray-200 transition-all" placeholder="Enter client seed" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Nonce
                        <input required type="text" value={nonce} onChange={e => setNonce(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-gray-200 transition-all" placeholder="e.g. 1" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        Drop Column (0-12)
                        <input required type="number" min="0" max="12" value={dropColumn} onChange={e => setDropColumn(e.target.value)} className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-gray-200 transition-all" />
                     </label>

                     <label className="flex flex-col gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest md:col-span-2 relative p-4 bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden">
                        <span className="flex justify-between items-center z-10 relative">
                           Round ID Database Link
                           <span className="font-normal text-gray-400 normal-case">(Optional Check)</span>
                        </span>
                        <input type="text" value={roundId} onChange={e => setRoundId(e.target.value)} className="mt-2 px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-gray-200 transition-all z-10 relative" placeholder="Provides matching validation + graphical replay" />
                     </label>
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-4 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-lg">
                     {loading ? 'Crunching Numbers...' : 'Verify Cryptographically'}
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
                     <span><strong>Commitment Phase:</strong> Before you drop the ball down the board, the server generates a cryptographically secure <code>serverSeed</code> string and a localized iterative <code>nonce</code> securely hidden away from you. It hashes them using SHA-256 and supplies you immediately with the resulting <code>commitHex</code>.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">2</strong>
                     <span><strong>Your Interaction:</strong> You provide your own randomly unpredictable hash, your <code>clientSeed</code> (visible client-side), and configure the specific physical mechanical <code>dropColumn</code> to skew probabilities.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">3</strong>
                     <span><strong>Deterministic Generation:</strong> The moment you push Start, our algorithms combine the constraints natively combining components: <code>SHA-256(serverSeed : clientSeed : nonce)</code> creating a completely unified transparent math-based master seed powering the entire physics drop mechanically reliably every singular time.</span>
                  </p>
                  <p className="flex gap-4">
                     <strong className="text-primary mt-1">4</strong>
                     <span><strong>Cryptographic Verification:</strong> Because the server explicitly surrendered the <code>commitHex</code> mathematically bound signature BEFORE you played, it is functionally impossible for anybody to surreptitiously intercept, alter or falsify the unexposed <code>serverSeed</code> mechanics directly responding to your wager natively securely.</span>
                  </p>
               </div>
            </details>
         </div>

         <div className="w-full lg:w-[480px] flex flex-col gap-6">

            {/* Results Data Table */}
            {results && (
               <div className="glass p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500" />
                  <h3 className="text-2xl font-bold mb-6">Verification Output</h3>

                  <div className="space-y-5 text-sm break-all font-mono">
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-500 uppercase tracking-widest text-[10px] block mb-1">Calculated Commit Hex</span>
                        <span className="text-gray-200">{results.commitHex}</span>
                     </div>
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-500 uppercase tracking-widest text-[10px] block mb-1">Computed Combined Seed</span>
                        <span className="text-primary">{results.combinedSeed}</span>
                     </div>
                     <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-gray-500 uppercase tracking-widest text-[10px] block mb-1">Simulated Peg Map Hash</span>
                        <span className="text-gray-200">{results.pegMapHash}</span>
                     </div>
                     <div className="bg-black/30 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                        <span className="text-gray-400 uppercase tracking-widest text-xs font-bold font-sans">Final Trajectory Bin</span>
                        <span className="text-white text-3xl font-bold font-sans bg-white/10 px-4 py-1 rounded-lg">{results.binIndex}</span>
                     </div>

                     {roundId && (
                        <div className="pt-4 mt-2 border-t border-white/10 flex items-center gap-3">
                           {results.match === true ? (
                              <div className="flex-1 bg-green-500/10 border border-green-500/30 p-3 rounded-xl text-green-400 flex items-center justify-center gap-2 font-sans font-bold shadow-lg">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                 Verified DB Match
                              </div>
                           ) : results.match === false ? (
                              <div className="flex-1 bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-500 flex items-center justify-center gap-2 font-sans font-bold shadow-lg">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                 Database Mismatch
                              </div>
                           ) : (
                              <div className="flex-1 bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl text-yellow-500 flex items-center justify-center gap-2 font-sans font-bold">
                                 Record Not Found
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* Permalink Copy */}
                  <div className="mt-8 flex flex-col gap-2">
                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-1">Share Proof Permalink</span>
                     <div className="flex bg-black/50 border border-white/10 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary transition-all">
                        <input readOnly value={permalink} className="bg-transparent flex-1 px-4 py-3 text-xs outline-none opacity-80" />
                        <button onClick={copyLink} className="px-6 bg-primary hover:bg-primary/80 transition-colors font-bold text-white text-sm">
                           {copied ? 'Copied!' : 'Copy'}
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* Dynamic Mini Replay Viewer */}
            <div className={`glass p-6 md:p-8 rounded-3xl border border-white/5 flex flex-col items-center transition-all duration-500 ease-in-out shadow-lg ${!results ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
               <div className="w-full flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Mini Replay</h3>
                  {results && !hasPath && (
                     <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">No Path Data</span>
                  )}
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
            <h1 className="text-3xl md:text-4xl font-extrabold gradient-text tracking-tight">Provability Verifier</h1>
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
