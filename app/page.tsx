'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import PlinkoBoard, { PlinkoBoardRef } from '@/components/PlinkoBoard';
import SessionLog from '@/components/SessionLog';

export default function PlinkoGame() {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [commitHex, setCommitHex] = useState<string>('');
  const [nonce, setNonce] = useState<string>('');
  const [serverSeed, setServerSeed] = useState<string | null>(null);
  const [combinedSeed, setCombinedSeed] = useState<string | null>(null);

  const [clientSeed, setClientSeed] = useState<string>('');
  const [dropColumn, setDropColumn] = useState<number>(6);
  const [betCents, setBetCents] = useState<number>(100);

  const [status, setStatus] = useState<'IDLE' | 'STARTED' | 'ANIMATING' | 'REVEALED'>('IDLE');
  const [payoutMultiplier, setPayoutMultiplier] = useState<number | null>(null);
  const [pegMap, setPegMap] = useState<number[][] | null>(null);

  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [showRng, setShowRng] = useState(false);

  const boardRef = useRef<PlinkoBoardRef>(null);
  const isRequesting = useRef(false);

  const generateUUID = () => {
    try {
      return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    } catch {
      return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }
  }

  // Generate UUID & access accessibility preferences 
  useEffect(() => {
    setClientSeed(generateUUID());
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const commitRound = useCallback(async () => {
    try {
      setStatus('IDLE');
      setServerSeed(null);
      setCombinedSeed(null);
      setPayoutMultiplier(null);
      setPegMap(null);

      const res = await fetch('/api/rounds/commit', { method: 'POST' });
      const data = await res.json();
      if (data.roundId) {
        setRoundId(data.roundId);
        setCommitHex(data.commitHex);
        setNonce(''); // Hid securely prior to actual deployment
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    commitRound();
  }, [commitRound]);

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
  }, [status, roundId, clientSeed, betCents, dropColumn]);

  const handleDrop = async () => {
    if (status !== 'IDLE' || !roundId || isRequesting.current) return;
    isRequesting.current = true;
    setStatus('STARTED');
    setPayoutMultiplier(null);
    setServerSeed(null);
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
    } catch (e) {
      console.error(e);
      setStatus('IDLE');
      isRequesting.current = false;
    }
  };

  const handleAnimationEnd = async (binIndex: number) => {
    if (!roundId) return;
    try {
      const res = await fetch(`/api/rounds/${roundId}/reveal`, { method: 'POST' });
      const data = await res.json();
      setServerSeed(data.serverSeed);
      setNonce(data.nonce); // Retrieve nonce post-round strictly securely!

      // Reload fresh properties tracking DB constraints
      const roundRes = await fetch(`/api/rounds/${roundId}`);
      const roundData = await roundRes.json();

      setCombinedSeed(roundData.combinedSeed);
      setPayoutMultiplier(roundData.payoutMultiplier);
      setStatus('REVEALED');

      setTimeout(() => {
        commitRound();
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

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
      `}</style>

      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-start gap-8">
        <header className="flex justify-between items-center mb-6 px-4">
          <h1 className="glitch-text text-5xl tracking-[0.2em]" data-content="PLINKO">Plinko</h1>
          <div className="flex gap-4 items-center">
            <button onClick={() => setMuted(!muted)} className="text-sm font-semibold hover:text-primary transition-colors text-gray-300">
              {muted ? 'Unmute' : 'Mute'}
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
            value={clientSeed}
            onChange={e => setClientSeed(e.target.value)}
            disabled={status !== 'IDLE'}
            className="px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-primary disabled:opacity-50 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Drop Column</label>
          <div className="flex border border-white/10 rounded-xl overflow-hidden glass">
            <button
              disabled={status !== 'IDLE' || dropColumn <= 0}
              onClick={() => setDropColumn(d => Math.max(0, d - 1))}
              className="flex-1 py-3 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 font-bold"
            >
              ←
            </button>
            <div className="flex-[2] flex justify-center items-center font-mono py-3 bg-black/40 border-x border-white/10 text-sm font-semibold">
              {dropColumn}
            </div>
            <button
              disabled={status !== 'IDLE' || dropColumn >= 12}
              onClick={() => setDropColumn(d => Math.min(12, d + 1))}
              className="flex-1 py-3 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-30 font-bold"
            >
              →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Bet Amount (Cents)</label>
          <input
            type="number"
            min={1}
            value={betCents}
            onChange={e => setBetCents(Number(e.target.value) || 1)}
            disabled={status !== 'IDLE'}
            className="px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-primary disabled:opacity-50 transition-colors font-mono"
          />
        </div>

        <button
          onClick={handleDrop}
          disabled={status !== 'IDLE'}
          className="w-full py-4 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transform transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:pointer-events-none disabled:shadow-none"
        >
          Drop Ball (Space)
        </button>

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
              <span className="text-gray-500 uppercase tracking-widest text-[10px]">Combined Seed:</span>
              {status === 'REVEALED' ? (
                <span className="text-green-400 truncate opacity-90" title={combinedSeed || ''}>{combinedSeed}</span>
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
