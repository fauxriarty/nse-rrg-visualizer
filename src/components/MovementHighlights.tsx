"use client";

import { useMemo } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { detectQuadrantJumps, Quadrant, RRGEntity } from '@/lib/rrgMovements';

interface MovementHighlightsProps {
  data: RRGEntity[];
  title?: string;
  subjectLabel?: string;
  intervalLabel?: string; // e.g., Daily / Weekly / Monthly
  backtestLabel?: string; // e.g., Live or YYYY-MM-DD
}

const quadrantStyles: Record<Quadrant, string> = {
  LEADING: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50',
  WEAKENING: 'bg-amber-900/30 text-amber-100 border-amber-700/40',
  IMPROVING: 'bg-blue-900/40 text-blue-100 border-blue-700/50',
  LAGGING: 'bg-rose-900/40 text-rose-100 border-rose-700/40',
};

const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

export default function MovementHighlights({ data, title = 'Noteworthy Movements', subjectLabel = 'item', intervalLabel = 'selected interval', backtestLabel = 'current snapshot' }: MovementHighlightsProps) {
  const jumps = useMemo(() => {
    const detected = detectQuadrantJumps(data);
    console.log('[MovementHighlights] Data items:', data.length, 'Detected jumps:', detected.length);
    if (detected.length > 0) {
      console.log('[MovementHighlights] Jumps:', detected);
    }
    return detected;
  }, [data]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-700/40">
            <Sparkles className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Day-over-Day Quadrant Changes</h3>
            <p className="text-[11px] text-slate-400">
              Changes from previous trading day to today (independent of interval setting)
            </p>
          </div>
        </div>
        {jumps.length > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {jumps.length} detected
          </span>
        )}
      </div>

      {jumps.length === 0 ? (
        <div className="text-xs text-slate-400 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl px-3 py-3">
          No quadrant changes from previous trading day for the selected {subjectLabel}s.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jumps.map((jump) => (
            <div key={jump.name} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{jump.name}</div>
                <div className="text-[10px] text-slate-400">Δ {jump.magnitude.toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={`px-2 py-1 rounded-lg border ${quadrantStyles[jump.from]}`}>{jump.from}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className={`px-2 py-1 rounded-lg border ${quadrantStyles[jump.to]}`}>{jump.to}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                ΔRS {formatDelta(jump.deltaX)} · ΔROC {formatDelta(jump.deltaY)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
