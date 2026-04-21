'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import RRGChart from '@/components/RRGChart';
import MovementHighlights from '@/components/MovementHighlights';
import { 
  RefreshCw, Activity, ArrowRight, TrendingUp, Zap, 
  Clock, Info, BarChart3, Calendar, ChevronDown, SlidersHorizontal, 
  BookOpen, Calculator, Database, Server, Sigma, History, X, Radar,
  BrainCircuit, Gauge, TriangleAlert, Award
} from 'lucide-react';
import { SECTOR_INDICES } from '@/lib/sectorConfig';
import { useToast } from '@/components/Toast';
import { enrichSectorsWithBrowserMl, warmupBrowserModels } from '@/lib/ml/browserInference';

// --- CONSTANTS ---
const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

export default function Home() {
    const toast = useToast();
  const requestSeqRef = useRef(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<'models' | 'history' | 'rrg'>('models');
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
  const aiRows = useMemo(() => {
    return [...data]
      .filter((item: any) => item?.ml?.primary && item?.ml?.legacy)
      .map((item: any) => {
        const primary = item.ml.primary;
        const legacy = item.ml.legacy;
        const upProbabilityPct = Math.max(0, Math.min(100, (primary?.probabilities?.up ?? 0) * 100));
        const downProbabilityPct = Math.max(0, Math.min(100, (primary?.probabilities?.down ?? 0) * 100));
        const neutralProbabilityPct = Math.max(0, Math.min(100, (primary?.probabilities?.neutral ?? 0) * 100));
        const legacyLeadPct = Math.max(0, Math.min(100, (legacy?.leadingProbability ?? 0) * 100));
        const riskGauge = Math.max(0, Math.min(100, legacy?.exhaustionRiskGauge ?? 0));
        const primaryAction = primary?.action ?? getPrimaryAction(primary, legacy);
        return {
          ...item,
          primary,
          legacy,
          upProbabilityPct,
          downProbabilityPct,
          neutralProbabilityPct,
          legacyLeadPct,
          riskGauge,
          primaryConfidencePct: Math.max(0, Math.min(100, (primary?.confidence ?? 0) * 100)),
          compositeScore: (upProbabilityPct * 0.55) + (legacyLeadPct * 0.20) - (riskGauge * 0.35),
          action: primaryAction,
        };
      });
  }, [data]);

  const actionDeskRows = useMemo(() => {
    const actionRank: Record<string, number> = { BUY: 0, HOLD: 1, SELL: 2 };

    return [...aiRows]
      .sort((a: any, b: any) => {
        const rankDelta = actionRank[a.action.label] - actionRank[b.action.label];
        if (rankDelta !== 0) return rankDelta;
        return b.compositeScore - a.compositeScore;
      });
  }, [aiRows]);

  const primaryLeaderRow = useMemo(() => {
    return [...aiRows].sort((a: any, b: any) => b.primaryConfidencePct - a.primaryConfidencePct)[0] ?? null;
  }, [aiRows]);

  const bestCompositeRow = useMemo(() => {
    return [...aiRows].sort((a: any, b: any) => b.compositeScore - a.compositeScore)[0] ?? null;
  }, [aiRows]);

  const exhaustionRow = useMemo(() => {
    return [...aiRows].sort((a: any, b: any) => b.riskGauge - a.riskGauge)[0] ?? null;
  }, [aiRows]);

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
    setLoadingPhase('models');
    const requestSeq = ++requestSeqRef.current;
    try {
      // 1) Ensure models are warm before network fetch so data + ML can render together.
      await warmupBrowserModels();
      if (requestSeq !== requestSeqRef.current) return;

      setLoadingPhase('history');

      const params = new URLSearchParams({ interval, rsWindow, rocWindow });
      
      // --- APPEND DATE IF BACKTESTING ---
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const fetchMarketData = async (forceRefresh: boolean) => {
        const reqParams = new URLSearchParams(params.toString());
        if (forceRefresh) reqParams.set('refresh', 'true');
        const res = await fetch(`/api/market-data?${reqParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
      };

      let json = await fetchMarketData(false);
      if ((json?.sectors?.length ?? 0) < 6) {
        // Retry once with refresh=true to recover from transient upstream throttling.
        json = await fetchMarketData(true);
      }

      if (requestSeq !== requestSeqRef.current) return;

      if (json.sectors) {
        try {
          setLoadingPhase('rrg');
          const enriched = await enrichSectorsWithBrowserMl(json.sectors);
          if (requestSeq !== requestSeqRef.current) return;
          setData(enriched);
        } catch (mlError) {
          console.error('[ML][browser][error] Unable to enrich sectors in browser:', mlError);
          throw mlError;
        }
      }
      if (json.config) setConfig(json.config);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load AI models or market data. Please refresh once.');
    } finally {
      setLoading(false);
    }
  }, [interval, rsWindow, rocWindow, backtestDate, toast]); // Trigger fetch when date changes

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
            <p className="text-slate-300 text-sm font-bold animate-pulse relative z-10">
              {loadingPhase === 'models'
                ? 'Loading AI models...'
                : loadingPhase === 'history'
                  ? 'Fetching history...'
                  : 'Running RRG algorithm...'}
            </p>
            <p className="text-slate-500 text-xs mt-2 relative z-10">
                {loadingPhase === 'models'
                  ? 'Downloading model files for this session'
                  : backtestDate
                    ? `Fetching history for ${backtestDate}`
                    : 'Fetching live market data'}
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

      <div className="max-w-7xl mx-auto mb-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-4 mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                  <Radar className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                  AI Sector Outlook
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  A simple sector decision layer that combines direction, momentum support, and trend heat.
                </p>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-full px-2.5 py-1">
                {aiRows.length} sectors scored
              </span>
            </div>

          </div>

          {aiRows.length > 0 && (
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" /> Direction Signal
                </div>
                <div className="text-sm font-bold text-slate-100">{primaryLeaderRow?.name}</div>
                <div className="text-xs text-cyan-300 mt-1">{getPrimarySignalDisplay(primaryLeaderRow).shortLabel}</div>
                <div className="text-[11px] text-slate-400 mt-2">
                  This is the main model call: whether the sector is likely to outperform, stay neutral, or underperform.
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" /> Momentum Support
                </div>
                <div className="text-sm font-bold text-slate-100">{bestCompositeRow?.name}</div>
                <div className="text-xs text-emerald-300 mt-1">{bestCompositeRow ? `${bestCompositeRow.legacyLeadPct.toFixed(0)}% support` : 'No signal yet'}</div>
                <div className="text-[11px] text-slate-400 mt-2">
                  A support score showing whether momentum is backing the main direction call.
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                  <TriangleAlert className="w-3.5 h-3.5 text-amber-400" /> Trend Heat
                </div>
                <div className="text-sm font-bold text-slate-100">{exhaustionRow?.name}</div>
                <div className="text-xs text-amber-300 mt-1">{exhaustionRow ? `${exhaustionRow.riskGauge.toFixed(0)}/100 stretch risk` : 'No signal yet'}</div>
                <div className="text-[11px] text-slate-400 mt-2">
                  A risk gauge showing how stretched the current trend may be.
                </div>
              </div>
            </div>
          )}

          {aiRows.length === 0 ? (
            <div className="relative z-10 text-sm text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-4">
              ML insights are not available yet for this dataset. This can happen during model warmup or if history is insufficient.
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-4">
              <div className="bg-slate-950/80 border border-cyan-900/40 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <BrainCircuit className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm sm:text-base font-bold text-cyan-100">How The AI Decision Is Built</h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mb-3">
                  Three models are combined in sequence. To reduce noise, the Direction column shows only the winning class probability.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] sm:text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                    <span className="font-semibold text-cyan-200">1) Direction Model</span>{' '}
                    <span className="text-slate-500">(model_sector_signal.onnx)</span>
                    <div className="text-slate-400 mt-1">Primary sector-relative call that classifies the setup as UP, NEUTRAL, or DOWN.</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                    <span className="font-semibold text-emerald-200">2) Momentum Support Model</span>{' '}
                    <span className="text-slate-500">(model_a_leading.onnx)</span>
                    <div className="text-slate-400 mt-1">Confirms whether rotation momentum supports the direction call.</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                    <span className="font-semibold text-amber-200">3) Trend Heat Model</span>{' '}
                    <span className="text-slate-500">(model_b_exhaustion.onnx)</span>
                    <div className="text-slate-400 mt-1">Risk veto layer that flags stretched conditions and can downgrade aggressive actions.</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-emerald-200 flex items-center gap-2 mb-1">
                  <Gauge className="w-4 h-4" /> Final Action Table
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  Decision order: Direction sets bias, Momentum Support confirms quality, Trend Heat can downgrade aggressive calls.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-800">
                        <th className="py-2 pr-3">Sector</th>
                        <th className="py-2 pr-3">Direction</th>
                        <th className="py-2 pr-3">Momentum Support</th>
                        <th className="py-2 pr-3">Trend Heat</th>
                        <th className="py-2 pr-3">Action Bias</th>
                        <th className="py-2">Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actionDeskRows.map((item: any) => {
                        const primarySignal = getPrimarySignalDisplay(item);
                        const legacyLeadBadge = getLegacyLeadBadge(item.legacyLeadPct);
                        const exhaustionBadge = getExhaustionBadge(item.riskGauge);
                        const actionNarrative = getActionNarrative(item);
                        return (
                          <tr key={`action-${item.name}`} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 pr-3 text-slate-100 font-semibold">{item.name}</td>
                            <td className="py-3 pr-3 text-cyan-300 text-xs sm:text-sm">{primarySignal.shortLabel}</td>
                            <td className="py-3 pr-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold border ${legacyLeadBadge.className}`}>
                                {legacyLeadBadge.label}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold border ${exhaustionBadge.className}`}>
                                {exhaustionBadge.label}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.action.className}`}>
                                {item.action.label}
                              </span>
                            </td>
                            <td className="py-3 text-slate-200 text-xs font-semibold">{actionNarrative}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
      
      {/* --- AI EXPLAINER GRID --- */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">
        
        {/* 1. WHAT MODELS DO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-cyan-500/10 rounded-lg"><BrainCircuit className="w-5 h-5 text-cyan-400" /></div>
             <h2 className="text-lg font-bold text-white">What The AI Models Measure</h2>
          </div>
          <div className="space-y-5 text-sm text-slate-400">
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <Radar className="w-3.5 h-3.5" /> Direction Signal (Primary Model)
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                Estimates whether a sector is more likely to <strong>outperform</strong>, stay <strong>neutral</strong>, or <strong>underperform</strong> versus peers.
              </p>
            </div>
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Momentum Support
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                Checks whether current rotation structure supports the main direction call. It works as a <strong>confirmation layer</strong>.
              </p>
            </div>
            <div>
              <h3 className="text-slate-200 font-semibold mb-1 flex items-center gap-2">
                <TriangleAlert className="w-3.5 h-3.5" /> Trend Heat
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                Gauges how stretched a move is. Higher heat means more pullback risk and lower confidence in aggressive entries.
              </p>
            </div>
          </div>
        </div>

        {/* 2. WHY SIGNALS ARE TRUSTWORTHY */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-blue-500/10 rounded-lg"><Gauge className="w-5 h-5 text-blue-400" /></div>
             <h2 className="text-lg font-bold text-white">How Reliability Is Controlled</h2>
          </div>
          <div className="space-y-4 text-sm text-slate-400">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">1. Conservative Action Thresholds</div>
              <p className="text-xs leading-relaxed">BUY and SELL are triggered only when probability is sufficiently strong. Mixed cases default to HOLD.</p>
            </div>
            
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">2. Multi-Layer Validation</div>
              <p className="text-xs leading-relaxed">Direction, momentum support, and trend heat are read together so one noisy signal does not dominate.</p>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">3. Cross-Sector Comparison</div>
              <p className="text-xs leading-relaxed">Signals are computed in a relative framework across sectors, which is more stable than isolated single-series forecasting.</p>
            </div>
          </div>
        </div>

        {/* 3. HOW TO USE ACTIONS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-full hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
             <div className="p-2 bg-emerald-500/10 rounded-lg"><BookOpen className="w-5 h-5 text-emerald-400" /></div>
             <h2 className="text-lg font-bold text-white">How To Read BUY / HOLD / SELL</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3 h-full">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400"><TrendingUp className="w-4 h-4" /></div>
              <div>
                <span className="text-xs font-bold text-emerald-400 block uppercase">BUY</span>
                <span className="text-[10px] text-slate-400">Direction is favorable and trend heat is controlled. Prefer adding on pullbacks, not spikes.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <div className="p-1.5 bg-amber-500/20 rounded text-amber-400"><Clock className="w-4 h-4" /></div>
              <div>
                <span className="text-xs font-bold text-amber-400 block uppercase">HOLD</span>
                <span className="text-[10px] text-slate-400">Signals are mixed or neutral. Wait for direction to strengthen before taking size.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="p-1.5 bg-red-500/20 rounded text-red-400"><TrendingUp className="w-4 h-4 rotate-180" /></div>
              <div>
                <span className="text-xs font-bold text-red-400 block uppercase">SELL</span>
                <span className="text-[10px] text-slate-400">Downside risk dominates or trend heat is extreme. Reduce exposure and avoid chasing.</span>
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

function getExhaustionBadge(gauge: number) {
  if (gauge < 35) {
    return {
      label: 'Stable',
      className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/40',
    };
  }

  if (gauge < 60) {
    return {
      label: 'Elevated Volatility',
      className: 'text-amber-300 border-amber-600/40 bg-amber-950/30',
    };
  }

  if (gauge < 80) {
    return {
      label: 'Overextended',
      className: 'text-orange-300 border-orange-600/40 bg-orange-950/30',
    };
  }

  return {
    label: 'Extreme Exhaustion',
    className: 'text-rose-300 border-rose-600/50 bg-rose-950/40',
  };
}

function getLegacyLeadBadge(probability: number) {
  if (probability < 35) {
    return {
      label: 'Low Support',
      className: 'text-slate-300 border-slate-600/40 bg-slate-800/40',
    };
  }

  if (probability < 65) {
    return {
      label: 'Building',
      className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
    };
  }

  if (probability < 85) {
    return {
      label: 'Strong Support',
      className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/30',
    };
  }

  return {
    label: 'Very Strong',
    className: 'text-teal-200 border-teal-500/50 bg-teal-900/30',
  };
}

function getPrimarySignalDisplay(row: any) {
  if (!row?.primary) {
    return {
      label: 'No signal',
      shortLabel: 'Primary model unavailable',
      className: 'text-slate-300 border-slate-600/40 bg-slate-800/40',
    };
  }

  const predictedLabel = row.primary.predictedLabel ?? 'NEUTRAL';
  const confidencePct = Math.max(0, Math.min(100, (row.primary.confidence ?? 0) * 100));

  if (predictedLabel === 'UP') {
    return {
      label: 'UP',
      shortLabel: `Uptrend probability ${confidencePct.toFixed(1)}%`,
      className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/35',
    };
  }

  if (predictedLabel === 'DOWN') {
    return {
      label: 'DOWN',
      shortLabel: `Downtrend probability ${confidencePct.toFixed(1)}%`,
      className: 'text-rose-300 border-rose-600/40 bg-rose-950/30',
    };
  }

  return {
    label: 'NEUTRAL',
    shortLabel: `Neutral probability ${confidencePct.toFixed(1)}%`,
    className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
  };
}

function getSetupBadge(score: number) {
  if (score < 20) {
    return {
      label: 'Avoid',
      className: 'text-rose-300 border-rose-600/40 bg-rose-950/30',
    };
  }

  if (score < 45) {
    return {
      label: 'Watch',
      className: 'text-amber-300 border-amber-600/40 bg-amber-950/30',
    };
  }

  if (score < 65) {
    return {
      label: 'Actionable',
      className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
    };
  }

  return {
    label: 'Top Setup',
    className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/35',
  };
}

function getPrimaryAction(primary: any, legacy: any) {
  if (primary?.action) return primary.action;

  const up = primary?.probabilities?.up ?? 0;
  const down = primary?.probabilities?.down ?? 0;
  const legacyRisk = legacy?.exhaustionRiskGauge ?? 0;

  if (up >= 0.39 && down < 0.3712 && legacyRisk < 60) {
    return {
      label: 'BUY',
      className: 'text-emerald-300 border-emerald-600/40 bg-emerald-950/35',
      reason: 'Upside probability is high while downside risk stays contained.',
    };
  }

  if (down >= 0.3712 || legacyRisk >= 75) {
    return {
      label: 'SELL',
      className: 'text-rose-300 border-rose-600/40 bg-rose-950/30',
      reason: 'Downside probability is high or the trend looks overextended.',
    };
  }

  return {
    label: 'HOLD',
    className: 'text-cyan-300 border-cyan-600/40 bg-cyan-950/30',
    reason: 'Signals are mixed, so wait for a cleaner directional edge.',
  };
}

function getActionNarrative(item: any) {
  const supportLabel = getLegacyLeadBadge(item?.legacyLeadPct ?? 0).label;
  const heatLabel = getExhaustionBadge(item?.riskGauge ?? 0).label;
  const actionLabel = item?.action?.label ?? 'HOLD';
  const up = item?.primary?.probabilities?.up ?? 0;
  const down = item?.primary?.probabilities?.down ?? 0;
  const buyThreshold = item?.primary?.buyThreshold ?? 0.39;
  const sellThreshold = item?.primary?.sellThreshold ?? 0.3712;
  const highHeat = (item?.riskGauge ?? 0) >= 60;
  const extremeHeat = (item?.riskGauge ?? 0) >= 75;

  if (actionLabel === 'BUY') {
    return 'Directional edge is confirmed and heat is controlled.';
  }

  if (actionLabel === 'SELL') {
    if (extremeHeat && down < sellThreshold) {
      return `Risk veto: heat is ${heatLabel}, so capital protection takes priority.`;
    }

    return 'Primary direction is bearish, so bias stays defensive.';
  }

  if (up >= buyThreshold && highHeat) {
    return `Upside exists, but heat is ${heatLabel}; waiting for a cleaner entry.`;
  }

  if (up > down && up < buyThreshold) {
    return 'Uptrend leads, but it has not cleared the BUY confidence cutoff yet.';
  }

  if (down >= sellThreshold && supportLabel !== 'Low Support') {
    return 'Bearish direction is partially offset by support, so action stays neutral.';
  }

  if (down > up && down < sellThreshold) {
    return 'Downtrend leads, but not strongly enough to trigger a SELL bias.';
  }

  return `Mixed setup: support is ${supportLabel} and heat is ${heatLabel}, so no strong edge yet.`;
}


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