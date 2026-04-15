'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SessionLog() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchRounds = async () => {
      try {
        const res = await fetch('/api/rounds?limit=20');
        const data = await res.json();
        if (Array.isArray(data)) setRounds(data);
      } catch (e) {
        console.error("Failed to fetch recent rounds", e);
      }
    };

    fetchRounds();
    const interval = setInterval(fetchRounds, 10000);
    return () => clearInterval(interval);
  }, []);

  const downloadCSV = () => {
    const header = ['Round ID', 'Time', 'Bin Index', 'Multiplier', 'Bet (Cents)', 'Payout (Cents)'];
    const rows = rounds.map(r => [
      r.id,
      new Date(r.createdAt).toLocaleString(),
      r.binIndex,
      r.payoutMultiplier,
      r.betCents,
      Math.floor(r.betCents * r.payoutMultiplier)
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [header, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plinko_session_log.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="glass rounded-3xl border border-white/5 overflow-hidden flex flex-col shadow-lg w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex justify-between items-center hover:bg-white/5 transition-colors focus:outline-none md:pointer-events-none"
      >
        <h3 className="font-bold text-xl">Session History <span className="text-sm font-normal text-gray-500">(Last 20)</span></h3>
        <span className="md:hidden text-gray-400 font-bold">{isOpen ? '▲' : '▼'}</span>
      </button>

      <div className={`flex-col md:flex ${isOpen ? 'flex border-t border-white/5' : 'hidden md:flex'}`}>
        <div className="px-5 py-3 flex justify-end">
          <button onClick={downloadCSV} className="text-xs tracking-widest uppercase font-bold bg-white/5 hover:bg-white/10 px-4 py-2 border border-white/10 rounded-lg transition-colors shadow-sm">
            Copy CSV
          </button>
        </div>
        <div className="overflow-x-auto px-5 pb-5 pt-0">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 border-b border-white/10 uppercase text-[10px] tracking-widest bg-black/20">
                <th className="py-3 px-4 rounded-tl-lg">ID</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Bin</th>
                <th className="py-3 px-4">Mult</th>
                <th className="py-3 px-4">Payout</th>
                <th className="py-3 px-4 text-right rounded-tr-lg">Action</th>
              </tr>
            </thead>
            <tbody className="bg-black/10">
              {rounds.map((r, i) => (
                <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="py-3 px-4 font-mono text-xs opacity-70" title={r.id}>...{r.id.substring(r.id.length - 6)}</td>
                  <td className="py-3 px-4 opacity-80 whitespace-nowrap">{new Date(r.createdAt).toLocaleTimeString()}</td>
                  <td className="py-3 px-4 font-bold">{r.binIndex}</td>
                  <td className={`py-3 px-4 font-bold ${r.payoutMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>{r.payoutMultiplier}×</td>
                  <td className="py-3 px-4 font-mono opacity-90 text-yellow-500">{(r.betCents * r.payoutMultiplier).toFixed(0)}¢</td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/verify?roundId=${r.id}`} target="_blank" className="inline-block px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded text-xs font-bold transition-colors shadow-sm whitespace-nowrap">
                      Verify ✓
                    </Link>
                  </td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500 text-sm tracking-wide">
                    No drops mapped locally. Play a round above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
