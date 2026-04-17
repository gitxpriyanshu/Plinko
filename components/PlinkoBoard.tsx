'use client';

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useCallback } from 'react';
import { PAYTABLE } from '@/lib/engine';

export interface PlinkoBoardRef {
  triggerDrop: (path: ('L' | 'R')[], binIndex: number) => void;
}

interface Props {
  pegMap: number[][] | null;
  dropColumn: number;
  onAnimationEnd?: (binIndex: number) => void;
  reducedMotion?: boolean;
  muted?: boolean;
  showRng?: boolean;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 600;
const ROWS = 12;
const PEG_SPACING = 42;
const ROW_SPACING = 36;
const START_Y = 80;
const BALL_RADIUS = 7;
const PEG_RADIUS = 5;
const STEP_DURATION = 300;

function getPegCoords(r: number, p: number) {
  const rowWidth = r * PEG_SPACING;
  const startX = CANVAS_WIDTH / 2 - rowWidth / 2;
  return { x: startX + p * PEG_SPACING, y: START_Y + r * ROW_SPACING };
}

function getBinCoords(b: number) {
  const rowWidth = ROWS * PEG_SPACING;
  const startX = CANVAS_WIDTH / 2 - rowWidth / 2;
  return { x: startX + b * PEG_SPACING, y: START_Y + ROWS * ROW_SPACING + 30 };
}

function getMultiplierColor(mult: number) {
  if (mult >= 10) return '#10b981'; // green-500
  if (mult >= 3) return '#34d399';  // green-400
  if (mult >= 2) return '#a78bfa';  // purple-400
  if (mult >= 1) return '#facc15';  // yellow-400
  return '#ef4444'; // red-500
}

const PlinkoBoard = forwardRef<PlinkoBoardRef, Props>(({
  pegMap,
  dropColumn,
  onAnimationEnd,
  reducedMotion = false,
  muted = false,
  showRng = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Animation state reference ensuring loop safety without constant setState re-renders
  const animRef = useRef<{
    active: boolean;
    startTime: number;
    points: { x: number, y: number }[];
    binIndex: number;
    lastTick: number;
    highlightBin: number | null;
    highlightStartTime: number;
  }>({
    active: false,
    startTime: 0,
    points: [],
    binIndex: -1,
    lastTick: -1,
    highlightBin: null,
    highlightStartTime: 0
  });

  // Safe Web Audio initialization based on interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playClick = useCallback(() => {
    if (muted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      // Slight pitch variation for realism
      osc.frequency.setValueAtTime(400 + Math.random() * 400, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch { }
  }, [muted]);

  const playChord = useCallback(() => {
    if (muted || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      // C Major triad values: C4, E4, G4
      [261.63, 329.63, 392.00].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      });
    } catch { }
  }, [muted]);

  useImperativeHandle(ref, () => ({
    triggerDrop: (path: ('L' | 'R')[], binIndex: number) => {
      const points: { x: number, y: number }[] = [];
      const startPeg = getPegCoords(0, 0);
      points.push({ x: startPeg.x, y: startPeg.y - 40 }); // Initial drop height
      points.push(startPeg); // Land on top peg

      let pos = 0;
      path.forEach((dir, r) => {
        if (dir === 'R') pos++;
        points.push(getPegCoords(r + 1, pos));
      });
      // Replace final peg index with definitive bin target coordinates
      points[points.length - 1] = getBinCoords(pos);

      animRef.current = {
        active: true,
        startTime: performance.now(),
        points,
        binIndex,
        lastTick: -1,
        highlightBin: null,
        highlightStartTime: 0
      };

      if (reducedMotion) {
        animRef.current.active = false;
        animRef.current.highlightBin = binIndex;
        animRef.current.highlightStartTime = performance.now();
        playChord();
        onAnimationEnd?.(binIndex);
      }
    }
  }));

  // Canvas paint loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const render = (time: number) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Draw Ghost column indicators (inverted triangles mapping to the 13 paths below)
      for (let c = 0; c <= ROWS; c++) {
        const rowWidth = ROWS * PEG_SPACING;
        const startX = CANVAS_WIDTH / 2 - rowWidth / 2;
        const x = startX + c * PEG_SPACING;
        const y = 30; // Above everything

        ctx.fillStyle = c === dropColumn ? 'rgba(139, 92, 246, 0.9)' : 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y - 6);
        ctx.lineTo(x, y + 6);
        ctx.fill();
      }

      // 2. Draw pegs
      for (let r = 0; r < ROWS; r++) {
        for (let p = 0; p <= r; p++) {
          const { x, y } = getPegCoords(r, p);
          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
          // Apply slight opacity variations based on server bias mapping if provided
          let alpha = 0.6;
          let bias: number | undefined;
          if (pegMap && pegMap[r] && typeof pegMap[r][p] === 'number') {
            bias = pegMap[r][p];
            alpha = 0.3 + (bias * 0.6); // slight visual hint
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();

          if (showRng && bias !== undefined) {
            ctx.fillStyle = '#34d399';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bias.toFixed(3), x, y - 8);
          }
        }
      }

      // 3. Draw end receptacles (bins)
      for (let b = 0; b <= ROWS; b++) {
        const { x, y } = getBinCoords(b);
        const mult = PAYTABLE[b];
        const isHighlight = animRef.current.highlightBin === b;

        let scale = 1;
        if (isHighlight) {
          const elapsed = time - animRef.current.highlightStartTime;
          if (elapsed < 800) {
            scale = 1 + 0.3 * Math.sin((elapsed / 800) * Math.PI); // Pulse dynamically
          }
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        const width = 34;
        const height = 24;
        ctx.fillStyle = getMultiplierColor(mult);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-width / 2, -height / 2, width, height, 4);
        } else {
          ctx.rect(-width / 2, -height / 2, width, height); // Fallback scaling for TS
        }
        ctx.fill();

        ctx.fillStyle = '#000000'; // Contrast text
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mult + 'x', 0, 0);
        ctx.restore();
      }

      // 4. Manage ball physics mapping and render
      const anim = animRef.current;
      if (anim.active && anim.points.length > 0) {
        const elapsed = time - anim.startTime;
        const totalDuration = (anim.points.length - 1) * STEP_DURATION;

        if (elapsed >= totalDuration) {
          // Completed drop simulation
          anim.active = false;
          anim.highlightBin = anim.binIndex;
          anim.highlightStartTime = time;
          playChord();
          onAnimationEnd?.(anim.binIndex);
        } else {
          // Mapping segment boundaries
          const progress = elapsed / STEP_DURATION;
          const stepIndex = Math.max(0, Math.floor(progress));
          const t = progress - stepIndex;

          if (stepIndex > anim.lastTick && stepIndex > 0) {
            playClick();
            anim.lastTick = stepIndex;
          }

          const p1 = anim.points[stepIndex];
          const p2 = anim.points[Math.min(stepIndex + 1, anim.points.length - 1)];

          // Linear travel matching horizontal progression seamlessly
          const currentX = p1.x + (p2.x - p1.x) * t;

          // Arc sine-wave bounce interpolation mapping physics gravity simulation 
          let currentY = p1.y + (p2.y - p1.y) * t;
          if (stepIndex > 0) {
            const bounceHeight = 16;
            currentY -= Math.sin(t * Math.PI) * bounceHeight;
          }

          ctx.beginPath();
          ctx.arc(currentX, currentY, BALL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15'; // Bright yellow
          ctx.fill();
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [dropColumn, onAnimationEnd, pegMap, playChord, playClick, showRng, muted]);

  return (
    <div className="w-full flex justify-center items-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-auto max-w-[700px] glass transition-all"
        style={{ aspectRatio: '700/600', borderRadius: '16px' }}
      />
    </div>
  );
});

PlinkoBoard.displayName = 'PlinkoBoard';
export default PlinkoBoard;
