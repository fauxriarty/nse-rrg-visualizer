'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import RRGChart from '@/components/RRGChart';
import MovementHighlights from '@/components/MovementHighlights';
import { 
  RefreshCw, Activity, ArrowRight, TrendingUp, Zap, 
  Clock, Info, BarChart3, Calendar, ChevronDown, SlidersHorizontal, 
  BookOpen, Calculator, Database, Server, Sigma, History, X
} from 'lucide-react';
import { SECTOR_INDICES } from '@/lib/sectorConfig';
import { useToast } from '@/components/Toast';

// --- CONSTANTS ---
const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

export default function Home() {
    const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);

  // Configuration State
  const [interval, setIntervalState] = useState('1d');
  const [rsWindow, setRsWindow] = useState('14');
  const [rocWindow, setRocWindow] = useState('14');
  const [backtestDate, setBacktestDate] = useState(new Date().toISOString().split('T')[0]);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const OVERVIEW_SECTORS = useMemo(() => SECTOR_INDICES.filter(s => s.name !== 'NIFTY 50'), []);

  useEffect(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    if (!uid || defaultsLoaded) return;
    (async () => {
      try {
        const res = await fetch('/api/user-settings', { headers: { 'x-user-id': uid } });
        const json = await res.json();
        const s = json.settings;
        if (s) {
          setIntervalState(s.interval || '1d');
          setRsWindow(String(s.rsWindow ?? '14'));
          setRocWindow(String(s.rocWindow ?? '14'));
        } else {
          const ls = localStorage.getItem(`defaults:${uid}`);
          if (ls) {
            const parsed = JSON.parse(ls);
            setIntervalState(parsed.interval || '1d');
            setRsWindow(String(parsed.rsWindow ?? '14'));
            setRocWindow(String(parsed.rocWindow ?? '14'));
          }
        }
      } catch {}
      setDefaultsLoaded(true);
    })();
  }, [defaultsLoaded]);

  const saveDefaults = useCallback(async () => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    if (!uid) return;
    const payload = { interval, rsWindow: Number(rsWindow), rocWindow: Number(rocWindow) };
    try {
      const res = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save settings' }));
        throw new Error(err.error || err.details || 'Failed to save settings');
      }
      localStorage.setItem(`defaults:${uid}`, JSON.stringify(payload));
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    }
  }, [interval, rsWindow, rocWindow]);

  const resetDefaults = useCallback(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    const ls = uid ? localStorage.getItem(`defaults:${uid}`) : null;
    if (ls) {
      const parsed = JSON.parse(ls);
      setIntervalState(parsed.interval || '1d');
      setRsWindow(String(parsed.rsWindow ?? '14'));
      setRocWindow(String(parsed.rocWindow ?? '14'));
    } else {
      setIntervalState('1d');
      setRsWindow('14');
      setRocWindow('14');
    }
  }, []);
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(
    new Set(SECTOR_INDICES.filter(s => s.name !== 'NIFTY 50').map(s => s.name))
  );
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const displayedSectors = useMemo(() => {
    const filtered = data.filter((s: any) => selectedSectors.has(s.name));
    console.log('[HomePage] displayedSectors:', filtered.length, 'from', data.length, 'data items, selectedSectors:', selectedSectors.size);
    return filtered;
  }, [data, selectedSectors]);
  const intervalLabel = useMemo(() => interval === '1d' ? 'Daily' : interval === '1mo' ? 'Monthly' : 'Weekly', [interval]);

  // --- DYNAMIC OPTIONS ---
  const rsOptions = useMemo(() => {
    if (interval === '1mo') {
      // Monthly: Limited options
      return [
        { label: '6 Bars', value: 6 },
        { label: '10 Bars', value: 10 },
        { label: '14 Bars (Std)', value: 14 },
        { label: '20 Bars', value: 20 }
      ];
    }
    if (interval === '1d') {
      // Daily: Most options available (2 years = ~500 trading days)
      return [
        { label: '10 Bars', value: 10 },
        { label: '14 Bars (Std)', value: 14 },
        { label: '20 Bars', value: 20 },
        { label: '28 Bars', value: 28 },
        { label: '50 Bars', value: 50 },
        { label: '100 Bars', value: 100 },
        { label: '200 Bars', value: 200 }
      ];
    }
    // Weekly: Good range (5 years = ~260 weeks)
    return [
      { label: '10 Bars', value: 10 },
      { label: '14 Bars (Std)', value: 14 },
      { label: '20 Bars', value: 20 },
      { label: '28 Bars', value: 28 },
      { label: '50 Bars', value: 50 },
      { label: '100 Bars', value: 100 }
    ];
  }, [interval]);

  const rocOptions = useMemo(() => {
    if (interval === '1mo') {
      // Monthly: Limited options due to less historical data
      return [
        { label: '1 Bar (Fast)', value: 1 },
        { label: '3 Bars', value: 3 },
        { label: '6 Bars', value: 6 }
      ];
    }
    if (interval === '1d') {
      // Daily: Most options available (2 years = ~500 trading days)
      return [
        { label: '1 Bar (Fast)', value: 1 },
        { label: '3 Bars', value: 3 },
        { label: '5 Bars', value: 5 },
        { label: '10 Bars', value: 10 },
        { label: '14 Bars (Std)', value: 14 },
        { label: '20 Bars', value: 20 },
        { label: '28 Bars', value: 28 },
        { label: '50 Bars', value: 50 },
        { label: '100 Bars', value: 100 },
        { label: '200 Bars', value: 200 }
      ];
    }
    // Weekly: Good range of options (5 years = ~260 weeks)
    return [
      { label: '1 Bar (Fast)', value: 1 },
      { label: '3 Bars', value: 3 },
      { label: '5 Bars', value: 5 },
      { label: '10 Bars', value: 10 },
      { label: '14 Bars (Std)', value: 14 },
      { label: '20 Bars', value: 20 },
      { label: '28 Bars', value: 28 },
      { label: '50 Bars', value: 50 }
    ];
  }, [interval]);

  useEffect(() => {
    const validRs = rsOptions.map(o => o.value.toString());
    const validRoc = rocOptions.map(o => o.value.toString());
    if (!validRs.includes(rsWindow)) setRsWindow(validRs[validRs.length - 1]); 
    if (!validRoc.includes(rocWindow)) setRocWindow(validRoc[0]); 
  }, [interval, rsOptions, rocOptions, rsWindow, rocWindow]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ interval, rsWindow, rocWindow });
      
      // --- APPEND DATE IF BACKTESTING ---
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const res = await fetch(`/api/market-data?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      if (json.sectors) setData(json.sectors);
      if (json.config) setConfig(json.config);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [interval, rsWindow, rocWindow, backtestDate]); // Trigger fetch when date changes

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 md:p-8 pb-20">
      
      {/* CONFIGURATION BAR */}
      <div className="max-w-7xl mx-auto mb-8 relative z-40">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl relative overflow-visible">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 to-purple-600/5 pointer-events-none"></div>
          
          <div className="flex flex-col gap-4 sm:gap-6 relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-fit">
              <div className="p-1.5 sm:p-2 bg-slate-800 rounded-lg border border-slate-700">
                <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base text-white">Configuration</h2>
                <p className="text-xs text-slate-500">Adjust math parameters</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 w-full">
              
              {/* SECTOR MULTISELECT */}
              <div className="flex flex-col gap-1.5 w-full relative">
                <label className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Sectors
                </label>
                <button
                  onClick={() => setShowSectorDropdown(!showSectorDropdown)}
                  className="w-full bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500 cursor-pointer flex items-center justify-between"
                >
                  <span className="text-xs">{selectedSectors.size} of {OVERVIEW_SECTORS.length}</span>
                  <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${showSectorDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSectorDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto" style={{ zIndex: 999 }}>
                    {OVERVIEW_SECTORS.map(sector => (
                      <label key={sector.name} className="flex items-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedSectors.has(sector.name)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedSectors);
                            if (e.target.checked) {
                              newSelected.add(sector.name);
                            } else {
                              newSelected.delete(sector.name);
                            }
                            setSelectedSectors(newSelected);
                          }}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-600 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-xs text-slate-300">{sector.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* --- BACKTESTING DATE PICKER --- */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                  <History className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Backtest Date
                </label>
                <div className="relative group">
                  <input 
                    type="date" 
                    max={new Date().toISOString().split("T")[0]} // Limit to today
                    value={backtestDate} 
                    onChange={(e) => setBacktestDate(e.target.value)}
                    className="w-full bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg px-2 sm:px-4 py-2 sm:py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500 cursor-pointer"
                  />
                </div>
              </div>

              <CustomSelect label="Interval" icon={<Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />} value={interval} onChange={setIntervalState} options={INTERVAL_OPTIONS} />
              <CustomSelect label="RS Period" icon={<BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />} value={rsWindow} onChange={setRsWindow} options={rsOptions} />
              <CustomSelect label="ROC Period" icon={<Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />} value={rocWindow} onChange={setRocWindow} options={rocOptions} />
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 sm:gap-3 w-full mt-3">
              <label className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-slate-400">Actions:</label>
              <button onClick={saveDefaults} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Save Settings</button>
              <button onClick={resetDefaults} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Reset to Defaults</button>
            </div>
          </div>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="max-w-7xl mx-auto mb-16">
        {loading || data.length === 0 ? (
          <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-inner relative overflow-hidden">
             <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4 relative z-10" />
            <p className="text-slate-300 text-sm font-bold animate-pulse relative z-10">Running RRG Algorithm...</p>
            <p className="text-slate-500 text-xs mt-2 relative z-10">
                {backtestDate ? `Fetching history for ${backtestDate}` : 'Fetching live market data'}
            </p>
          </div>
        ) : (
          <RRGChart data={data} interval={interval} config={config} enableSectorNavigation={true} selectedSectorNames={selectedSectors} />
        )}
      </div>

      {selectedSectors.size > 0 && (
        <div className="max-w-7xl mx-auto mb-12">
          <MovementHighlights 
            data={displayedSectors as any}
            subjectLabel="sector"
          />
        </div>
      )}

      {/* --- UNDERSTANDING CONFIGURATION PARAMETERS --- */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
            <div className="p-2 bg-indigo-500/10 rounded-lg"><Sigma className="w-5 h-5 text-indigo-500" /></div>
            <h2 className="text-lg font-bold text-white">Understanding Configuration Parameters</h2>
          </div>
          
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            The settings for <strong>RS</strong> (Relative Strength) and <strong>ROC</strong> (Rate of Change) periods control the <em>sensitivity</em> and <em>time horizon</em> of your analysis. Changing them allows you to switch between being a day trader (who cares about what happened recently) and a long-term investor (who cares about the last year).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* RS Period Explanation */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-500/20 rounded"><ArrowRight className="w-4 h-4 text-blue-400" /></div>
                <h3 className="text-sm font-bold text-blue-300">RS Period (The "Trend" / X-Axis)</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3 italic">Measures Direction: "Is this sector beating the market?"</p>
              
              <div className="space-y-3">
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/30">
                  <div className="text-[10px] font-bold text-emerald-400 mb-1">LOW VALUE (e.g., 10 bars)</div>
                  <div className="text-[10px] text-slate-400 mb-1"><strong>Effect:</strong> Very sensitive. Reacts quickly to recent price action.</div>
                  <div className="text-[10px] text-slate-300"><strong>Use Case:</strong> Swing Trading. Catch new trends early, even with noise.</div>
                </div>
                
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/30">
                  <div className="text-[10px] font-bold text-purple-400 mb-1">HIGH VALUE (e.g., 28 or 50 bars)</div>
                  <div className="text-[10px] text-slate-400 mb-1"><strong>Effect:</strong> Very smooth. Requires sustained moves to shift position.</div>
                  <div className="text-[10px] text-slate-300"><strong>Use Case:</strong> Long-Term Investing. Ignore daily noise, see major shifts.</div>
                </div>
              </div>
            </div>

            {/* ROC Period Explanation */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-500/20 rounded"><TrendingUp className="w-4 h-4 text-amber-400" /></div>
                <h3 className="text-sm font-bold text-amber-300">ROC Period (The "Momentum" / Y-Axis)</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3 italic">Measures Speed/Acceleration: "Is this sector speeding up or slowing down?"</p>
              
              <div className="space-y-3">
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/30">
                  <div className="text-[10px] font-bold text-emerald-400 mb-1">LOW VALUE (e.g., 1 bar)</div>
                  <div className="text-[10px] text-slate-400 mb-1"><strong>Effect:</strong> Extremely volatile. Measures day-to-day changes.</div>
                  <div className="text-[10px] text-slate-300"><strong>Use Case:</strong> Precision Timing. Spot exact moments when trends pause.</div>
                </div>
                
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-700/30">
                  <div className="text-[10px] font-bold text-purple-400 mb-1">HIGH VALUE (e.g., 12 or 14 bars)</div>
                  <div className="text-[10px] text-slate-400 mb-1"><strong>Effect:</strong> Smoother momentum over longer windows.</div>
                  <div className="text-[10px] text-slate-300"><strong>Use Case:</strong> Trend Strength. Confirm sustained power, not one-day pops.</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      {/* --- 3-COLUMN INFO GRID (Included for completeness) --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">
        
        {/* 1. DATA ARCHITECTURE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-purple-500/10 rounded-lg"><Server className="w-5 h-5 text-purple-500" /></div>
             <h2 className="text-lg font-bold text-white">Data Architecture</h2>
          </div>
          <div className="space-y-5 text-sm text-slate-400">
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <Database className="w-3.5 h-3.5" /> The "Iceberg" Fetch
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                To calculate a single point (e.g. 50-bar trend), we need massive history. We fetch <strong>2 years</strong> for Daily and <strong>5 years</strong> for Weekly charts. This buffer prevents errors during market holidays.
              </p>
            </div>
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <Server className="w-3.5 h-3.5" /> Smart Cache (30m TTL)
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                All API fetches are cached in memory + disk for 30 minutes. Refresh uses the cache unless explicitly forced, so we stay under vendor rate limits while keeping data fresh twice per hour.
              </p>
            </div>
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> Null-Tolerant Engine
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                If a sector (like a new IPO) lacks data, our math engine doesn't crash. It dynamically shrinks the smoothing window to the "best possible" fit for that specific stock.
              </p>
            </div>
          </div>
        </div>

        {/* 2. THE MATH ENGINE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-blue-500/10 rounded-lg"><Calculator className="w-5 h-5 text-blue-500" /></div>
             <h2 className="text-lg font-bold text-white">The Math Engine</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">1. Relative Strength (RS)</div>
              <code className="text-xs text-blue-300 font-mono block">Price_Sector / Price_Nifty50</code>
            </div>
            
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">2. Simple Moving Average (SMA)</div>
              <p className="text-[10px] text-slate-400 mb-1">Smoothes the curve. 'n' = RS Period.</p>
              <code className="text-xs text-blue-300 font-mono block">Sum(Last_n_RS) / n</code>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">3. Momentum (Y-Axis)</div>
              <p className="text-[10px] text-slate-400 mb-1">Velocity vs 'n' bars ago. 'n' = ROC Period.</p>
              <code className="text-xs text-blue-300 font-mono block">(Ratio_Now / Ratio_n_Ago) * 100</code>
            </div>
          </div>
        </div>

        {/* 3. STRATEGY PLAYBOOK */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-emerald-500/10 rounded-lg"><BookOpen className="w-5 h-5 text-emerald-500" /></div>
             <h2 className="text-lg font-bold text-white">Strategy Playbook</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3 h-full">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400"><TrendingUp className="w-4 h-4" /></div>
              <div>
                <span className="text-xs font-bold text-emerald-400 block uppercase">Leading (Top Right)</span>
                <span className="text-[10px] text-slate-400">Trend Strong + Speed Increasing. <strong>Buy.</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="p-1.5 bg-amber-500/20 rounded text-amber-400"><Clock className="w-4 h-4" /></div>
              <div>
                <span className="text-xs font-bold text-amber-400 block uppercase">Weakening (Bottom Right)</span>
                <span className="text-[10px] text-slate-400">Trend Strong + Speed Falling. <strong>Book Profit.</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="p-1.5 bg-red-500/20 rounded text-red-400"><TrendingUp className="w-4 h-4 rotate-180" /></div>
              <div>
                <span className="text-xs font-bold text-red-400 block uppercase">Lagging (Bottom Left)</span>
                <span className="text-[10px] text-slate-400">Trend Weak + Speed Falling. <strong>Avoid.</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="p-1.5 bg-blue-500/20 rounded text-blue-400"><Zap className="w-4 h-4" /></div>
              <div>
                <span className="text-xs font-bold text-blue-400 block uppercase">Improving (Top Left)</span>
                <span className="text-[10px] text-slate-400">Trend Weak + Speed Rising. <strong>Watchlist.</strong></span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto border-t border-slate-800 pt-8 text-slate-500 text-xs sm:text-sm flex flex-col sm:flex-row justify-between items-center gap-4">
         <p className="flex items-center gap-2">
           <Info className="w-4 h-4" />
           <span>Benchmark: <strong>Nifty 50</strong> (^NSEI)</span>
         </p>
         <p>Data provided by Yahoo Finance (Delayed 15m).</p>
       </div>

    </main>
  );
}

// --- HELPER COMPONENTS ---

function CustomSelect({ label, icon, value, onChange, options }: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="relative group">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500 cursor-pointer"
        >
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-white transition-colors">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}