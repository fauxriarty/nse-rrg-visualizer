'use client';

import { useEffect, useState } from 'react';
import RRGChart from '@/components/RRGChart';
import { RefreshCw, Activity, ArrowRight, TrendingUp, Target, Zap, Clock } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market-data');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      if (json.sectors) setData(json.sectors);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans p-6 md:p-8">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-10 flex justify-between items-center border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Market<span className="text-blue-500">RRG</span></h1>
            <p className="text-slate-400 text-sm font-medium">Relative Strength & Momentum Visualizer</p>
          </div>
        </div>
        
        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-all border border-slate-700 hover:border-slate-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Crunching Data...' : 'Refresh Analysis'}
        </button>
      </header>

      {/* STRATEGY & ANALYSIS SECTION */}
      <div className="max-w-7xl mx-auto mb-12 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-white">Analysis Strategy & Predictive Logic</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CARD 1: IDENTIFY LEADERS */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <h3 className="font-bold text-sm uppercase tracking-wider">1. Identify Smart Money</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              The <strong>X-Axis (Relative Trend)</strong> tells you <em>where</em> the institutional money is flowing. A sector right of center is currently the "Flavor of the Market".
            </p>
            <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/10">
              <p className="text-xs font-medium text-emerald-300">
                <strong>Prediction Tip:</strong> Do not short stocks in the "Leading" quadrant. Focus your stock picking ONLY in sectors with RS-Ratio {'>'} 100.
              </p>
            </div>
          </div>

          {/* CARD 2: SPOT REVERSALS */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Zap className="w-4 h-4" />
              <h3 className="font-bold text-sm uppercase tracking-wider">2. Early Warning System</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              <strong>Momentum (Y-Axis)</strong> turns <em>before</em> price. If a sector is Leading but Momentum drops below 100, the rally is tired.
            </p>
            <div className="p-3 bg-blue-500/5 rounded border border-blue-500/10">
              <p className="text-xs font-medium text-blue-300">
                <strong>Prediction Tip:</strong> A drop in momentum while RS is still high is your first signal to book profits before the crowd realizes the trend is over.
              </p>
            </div>
          </div>

          {/* CARD 3: PREDICT ROTATION */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              <Clock className="w-4 h-4" />
              <h3 className="font-bold text-sm uppercase tracking-wider">3. The Rotation Cycle</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Markets move clockwise. Money rotates from <strong>Improving</strong> → <strong>Leading</strong> → <strong>Weakening</strong> → <strong>Lagging</strong>.
            </p>
            <div className="p-3 bg-amber-500/5 rounded border border-amber-500/10">
              <p className="text-xs font-medium text-amber-300">
                <strong>Prediction Tip:</strong> The "Sweet Spot" entry is when a sector moves from Improving (Blue) into Leading (Green). This catches the start of a major trend.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="max-w-7xl mx-auto mb-10">
        {loading || data.length === 0 ? (
          <div className="w-full h-150 flex flex-col items-center justify-center bg-[#0B1121] rounded-xl border border-slate-800">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-slate-400 text-sm font-medium animate-pulse">Computing Sector Rotation...</p>
          </div>
        ) : (
          <RRGChart data={data} />
        )}
      </div>

      {/* QUADRANT DEFINITIONS */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" /> 
          Quadrant Interpretation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard 
            title="Leading" 
            color="text-emerald-400" 
            bg="bg-emerald-500/10" 
            border="border-emerald-500/20" 
            desc="Outperforming & Accelerating. The strongest sectors attracting aggressive buying." 
            action="Buy / Hold" 
          />
          <StatusCard 
            title="Weakening" 
            color="text-amber-400" 
            bg="bg-amber-500/10" 
            border="border-amber-500/20" 
            desc="Still strong, but losing steam. Smart money is starting to take profits here." 
            action="Book Profit" 
          />
          <StatusCard 
            title="Lagging" 
            color="text-red-400" 
            bg="bg-red-500/10" 
            border="border-red-500/20" 
            desc="Underperforming & Weak. Money is flowing OUT of these sectors." 
            action="Avoid / Short" 
          />
          <StatusCard 
            title="Improving" 
            color="text-blue-400" 
            bg="bg-blue-500/10" 
            border="border-blue-500/20" 
            desc="Underperforming but gaining momentum. Accumulation phase starting." 
            action="Watchlist" 
          />
        </div>
      </div>

    </main>
  );
}

// Reusable Card Component
function StatusCard({ title, color, bg, border, desc, action }: any) {
  return (
    <div className={`p-5 rounded-xl border ${border} ${bg} backdrop-blur-sm transition-transform hover:-translate-y-1`}>
      <h3 className={`font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2 ${color}`}>
        <TrendingUp className="w-4 h-4" /> {title}
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-4 h-10 font-medium opacity-90">{desc}</p>
      <div className={`text-xs font-bold flex items-center gap-1 uppercase tracking-wider ${color}`}>
        {action} <ArrowRight className="w-3 h-3" />
      </div>
    </div>
  )
}