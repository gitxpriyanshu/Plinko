'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import PlinkoBoard, { PlinkoBoardRef } from '@/components/PlinkoBoard';
import SessionLog from '@/components/SessionLog';

export default function PlinkoGame() {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [commitHex, setCommitHex] = useState<string>('');
  const [serverSeed, setServerSeed] = useState<string | null>(null);
  const [combinedSeed, setCombinedSeed] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string>('');

  const [clientSeed, setClientSeed] = useState<string>('');
  const [dropColumn, setDropColumn] = useState<number>(6);
  const [betCents, setBetCents] = useState<number>(100);

  const [status, setStatus] = useState<'IDLE' | 'STARTED' | 'ANIMATING' | 'REVEALED'>('STARTED');
  const [payoutMultiplier, setPayoutMultiplier] = useState<number | null>(null);
  const [pegMap, setPegMap] = useState<number[][] | null>(null);

  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [showRng, setShowRng] = useState(false);

  const boardRef = useRef<PlinkoBoardRef>(null);
  const isRequesting = useRef(false);

  // UX Feedback State
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const generateUUID = () => {
    try {
      return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    } catch {
      return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }
  }

  // Generate UUID & access accessibility preferences 
  // Restore preferences and init seeds
  useEffect(() => {
    setClientSeed(generateUUID());
    
    // Mute persistence
    const savedMute = localStorage.getItem('plinko_muted');
    if (savedMute === 'true') setMuted(true);

    // Reduced motion detection
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Save mute preference
  useEffect(() => {
    localStorage.setItem('plinko_muted', muted.toString());
  }, [muted]);

  const commitRound = useCallback(async () => {
    try {
      // Don't set IDLE here, keep it in a 'waiting' state
      setCombinedSeed(null);
      setPayoutMultiplier(null);
      setPegMap(null);

      const res = await fetch('/api/rounds/commit', { method: 'POST' });
      const data = await res.json();
      if (data.roundId) {
        setRoundId(data.roundId);
        setCommitHex(data.commitHex);
        setNonce(data.nonce);
        setStatus('IDLE'); // Now it's safe to play
      }
    } catch {
      setStatus('IDLE'); // Fallback to avoid permalock
    }
  }, []);

  useEffect(() => {
    commitRound();
  }, [commitRound]);

  const handleDrop = useCallback(async () => {
    if (status !== 'IDLE' || !roundId || isRequesting.current) return;
    isRequesting.current = true;
    setStatus('STARTED');
    setPayoutMultiplier(null);
    setCombinedSeed(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSeed, betCents, dropColumn })
      });
      const data = await res.json();

      if (data.error || !data.path) {
        setStatus('IDLE');
        alert(data.error || "Failed to start drop");
        isRequesting.current = false;
        return;
      }

      setPegMap(data.pegMap);
      setStatus('ANIMATING');
      boardRef.current?.triggerDrop(data.path, data.binIndex);
      isRequesting.current = false;
    } catch {
      setStatus('IDLE');
      isRequesting.current = false;
    }
  }, [status, roundId, clientSeed, betCents, dropColumn]);

  const handleAnimationEnd = useCallback(async () => {
    if (!roundId) return;
    try {
      const res = await fetch(`/api/rounds/${roundId}/reveal`, { method: 'POST' });
      await res.json();
      setCombinedSeed(null); // Explicit reset
      setStatus('REVEALED');
      
      // Reload fresh properties tracking DB constraints
      const roundRes = await fetch(`/api/rounds/${roundId}`);
      const roundData: { combinedSeed: string, serverSeed: string, nonce: string, payoutMultiplier: number } = await roundRes.json();

      setServerSeed(roundData.serverSeed);
      setCombinedSeed(roundData.combinedSeed);
      setNonce(roundData.nonce);
      setPayoutMultiplier(roundData.payoutMultiplier);
      setStatus('REVEALED');

      setTimeout(() => {
        commitRound();
      }, 2000);
    } catch {
      // Final reveal catch
    }
  }, [roundId, commitRound]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'ArrowLeft') {
        setDropColumn(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setDropColumn(prev => Math.min(12, prev + 1));
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handleDrop();
      } else if (e.key.toLowerCase() === 't') {
        setTilt(prev => !prev);
      } else if (e.key.toLowerCase() === 'g') {
        setShowRng(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDrop]);

  return (
    <div className={`min-h-screen p-4 flex flex-col md:flex-row gap-8 ${tilt ? 'tilt' : ''}`}>
      <style suppressHydrationWarning>{`
        .tilt {
          transform: rotate(-5deg);
          filter: sepia(0.6);
          transition: transform 0.5s ease, filter 0.5s ease;
        }
        @keyframes burst {
          0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1) rotate(var(--r)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
          .tilt {
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-start gap-8">
        <header className="flex justify-between items-center mb-6 px-4">
          <h1 className="glitch-text text-5xl tracking-[0.2em]" data-content="PLINKO">Plinko</h1>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setMuted(!muted)} 
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all focus:ring-2 focus:ring-primary/50 outline-none select-none flex items-center gap-2"
            >
              {muted ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  <span>Mute</span>
                </>
              )}
            </button>
            <Link href="/verify" className="text-sm font-semibold hover:text-primary transition-colors text-gray-300">
              Verify
            </Link>
          </div>
        </header>

        <div className="relative glass p-4 md:p-8 rounded-2xl flex-1 flex items-center justify-center border border-white/5 shadow-2xl">
          {status === 'REVEALED' && payoutMultiplier !== null && payoutMultiplier >= 1 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center z-50">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-sm shadow-sm"
                  style={{
                    backgroundColor: ['#ef4444', '#facc15', '#10b981', '#3b82f6', '#a78bfa'][Math.floor(Math.random() * 5)],
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%)`,
                    animation: `burst 1s forwards cubic-bezier(.17,.89,.32,1.28)`,
                    ['--tx' as string]: `${(Math.random() - 0.5) * 500}px`,
                    ['--ty' as string]: `${(Math.random() - 0.5) * 500 - 150}px`,
                    ['--r' as string]: `${Math.random() * 720}deg`,
                  }}
                />
              ))}
            </div>
          )}

          <PlinkoBoard
            ref={boardRef}
            pegMap={pegMap}
            dropColumn={dropColumn}
            onAnimationEnd={handleAnimationEnd}
            reducedMotion={reducedMotion}
            muted={muted}
            showRng={showRng}
          />
        </div>

        <SessionLog />
      </main>

      <aside className="w-full md:w-96 glass p-6 rounded-2xl flex flex-col gap-6 shadow-2xl border border-white/5 h-fit">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Controls</h2>
          <div className="flex gap-2">
            {showRng && <span className="text-[10px] uppercase bg-primary/20 text-primary px-2 py-1 rounded-sm">RNG ON</span>}
            {tilt && <span className="text-[10px] uppercase bg-amber-500/20 text-amber-500 px-2 py-1 rounded-sm">TILT ON</span>}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Client Seed</label>
          <input
            type="text"
            aria-label="Client Seed Input"
            value={clientSeed}
            onChange={e => setClientSeed(e.target.value)}
            disabled={status !== 'IDLE'}
            className="px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-all font-mono"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Drop Column</label>
          <div className="flex border border-white/10 rounded-xl overflow-hidden glass">
            <button
              disabled={status !== 'IDLE' || dropColumn <= 0}
              onClick={() => setDropColumn(d => Math.max(0, d - 1))}
              aria-label="Decrease Drop Column"
              className="flex-1 py-3 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 font-bold focus:bg-white/5 outline-none"
            >
              ←
            </button>
            <div className="flex-[2] flex justify-center items-center font-mono py-3 bg-black/40 border-x border-white/10 text-sm font-semibold">
              {dropColumn}
            </div>
            <button
              disabled={status !== 'IDLE' || dropColumn >= 12}
              onClick={() => setDropColumn(d => Math.min(12, d + 1))}
              aria-label="Increase Drop Column"
              className="flex-1 py-3 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 font-bold focus:bg-white/5 outline-none"
            >
              →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Bet Amount (Cents)</label>
          <input
            type="number"
            aria-label="Bet Amount in Cents"
            min={1}
            value={betCents}
            onChange={e => setBetCents(Number(e.target.value) || 1)}
            disabled={status !== 'IDLE'}
            className="px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-all font-mono"
          />
        </div>

        <button
          onClick={handleDrop}
          disabled={status !== 'IDLE' || !roundId}
          aria-label="Drop Ball Button"
          className="w-full py-4 mt-2 bg-primary hover:bg-primary/91 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transform transition-all active:scale-95 focus:ring-4 focus:ring-primary/40 outline-none disabled:opacity-50 disabled:active:scale-100 disabled:pointer-events-none disabled:shadow-none"
        >
          {!roundId ? 'Syncing Round...' : 'Drop Ball'}
        </button>

        <div className="text-center text-[10px] text-gray-500 font-semibold tracking-widest uppercase">
          ← → to move | Space to drop
        </div>

        <div className="pt-6 mt-auto border-t border-white/10">
          <h3 className="text-sm font-bold mb-3 tracking-wide">Round Status</h3>
          <div aria-live="polite" className="text-xs font-mono text-gray-300 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 uppercase tracking-widest text-[10px]">Commit Hex:</span>
              <span className="group relative cursor-help truncate opacity-80" title={commitHex}>
                {commitHex || 'Initializing...'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center pr-1">
                <span className="text-gray-500 uppercase tracking-widest text-[10px]">Nonce:</span>
                <button 
                  onClick={() => copyToClipboard(nonce, 'nonce')}
                  aria-label="Copy Nonce"
                  className="text-[10px] text-primary hover:text-white transition-colors font-bold uppercase"
                >
                  {copyFeedback === 'nonce' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <span className="text-white font-mono text-xs opacity-90 truncate" title={nonce}>{nonce || 'Initializing...'}</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center pr-1">
                <span className="text-gray-500 uppercase tracking-widest text-[10px]">Server Seed (Revealed):</span>
                {status === 'REVEALED' && serverSeed && (
                  <button 
                    onClick={() => copyToClipboard(serverSeed, 'server')}
                    aria-label="Copy Server Seed"
                    className="text-[10px] text-primary hover:text-white transition-colors font-bold uppercase"
                  >
                    {copyFeedback === 'server' ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {status === 'REVEALED' ? (
                <div className="bg-amber-400/10 border border-amber-400/20 p-2 rounded-lg text-amber-400 font-bold text-[10px] break-all font-mono">
                  {serverSeed}
                </div>
              ) : (
                <span className="text-gray-600 italic">Locked until reveal</span>
              )}
            </div>

            <div className="flex flex-col gap-1 relative group/combined">
              <div className="flex justify-between items-center pr-1">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 uppercase tracking-widest text-[10px]">Combined Seed:</span>
                  <div className="hidden md:block relative group">
                    <span className="cursor-help text-primary/60 hover:text-primary text-[10px]">ⓘ</span>
                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-gray-400 leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                      Derived from SHA256(serverSeed + &quot;:&quot; + clientSeed + &quot;:&quot; + nonce)
                    </div>
                  </div>
                </div>
                {status === 'REVEALED' && combinedSeed && (
                  <button 
                    onClick={() => copyToClipboard(combinedSeed, 'combined')}
                    aria-label="Copy Combined Seed"
                    className="text-[10px] text-primary hover:text-white transition-colors font-bold uppercase"
                  >
                    {copyFeedback === 'combined' ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              
              {status === 'REVEALED' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-green-400 font-bold truncate opacity-90 text-sm font-mono" title={combinedSeed || ''}>{combinedSeed}</span>
                  <span className="md:hidden text-[9px] text-gray-500 italic">SHA256(serverSeed : clientSeed : nonce)</span>
                </div>
              ) : (
                <span className="text-gray-600 italic">Hidden until reveal</span>
              )}
            </div>
          </div>
        </div>

        {status === 'REVEALED' && payoutMultiplier !== null && (
          <div className={`p-4 rounded-xl text-center font-bold animate-pulse shadow-lg ${payoutMultiplier >= 1 ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            You won {payoutMultiplier}×! {payoutMultiplier >= 1 ? '🎉' : '💸'}
          </div>
        )}
      </aside>
    </div>
  );
}
