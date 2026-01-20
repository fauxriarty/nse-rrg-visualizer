'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import RRGChart from '@/components/RRGChart';
import StockPriceChart from '@/components/StockPriceChart';
import MovementHighlights from '@/components/MovementHighlights';
import { 
  RefreshCw, Activity, BarChart3, Calendar, ChevronDown, 
  Clock, SlidersHorizontal, History, TrendingUp
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { SECTOR_INDICES } from '@/lib/sectorConfig';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

function SectorsPageContent() {
  const toast = useToast();
  // Require auth: redirect if not logged in
  useEffect(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) {
      router.replace('/auth');
    }
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [sectorName, setSectorName] = useState('');
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [hoveredStock, setHoveredStock] = useState<string | null>(null);
  const [showStockChart, setShowStockChart] = useState(false);
  const displayedStocks = useMemo(() => data.filter((s: any) => selectedStocks.has(s.name)), [data, selectedStocks]);

  // Configuration State
  const [selectedSector, setSelectedSector] = useState(() => {
    return searchParams.get('sector') || '^NSEBANK';
  });
  const [interval, setIntervalState] = useState('1d');
  const [rsWindow, setRsWindow] = useState('14');
  const [rocWindow, setRocWindow] = useState('14');
  const [backtestDate, setBacktestDate] = useState(new Date().toISOString().split('T')[0]);
  const [benchmark, setBenchmark] = useState<'sector' | 'nifty'>('sector'); // 'sector' or 'nifty'
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  
  const intervalLabel = useMemo(() => interval === '1d' ? 'Daily' : interval === '1mo' ? 'Monthly' : 'Weekly', [interval]);

  // Initialize sector name when selected sector changes
  useEffect(() => {
    const sectorInfo = SECTOR_INDICES.find(s => s.symbol === selectedSector);
    if (sectorInfo) {
      setSectorName(sectorInfo.name);
    }
  }, [selectedSector]);

  // Load user defaults
  useEffect(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    if (!userId || defaultsLoaded) return;
    (async () => {
      try {
        const res = await fetch('/api/user-settings', { headers: { 'x-user-id': userId } });
        const json = await res.json();
        const s = json.settings;
        if (s) {
          setIntervalState(s.interval || '1d');
          setRsWindow(String(s.rsWindow ?? '14'));
          setRocWindow(String(s.rocWindow ?? '14'));
        } else {
          // localStorage fallback
          const ls = localStorage.getItem(`defaults:${userId}`);
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
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    if (!userId) return;
    const payload = { interval, rsWindow: Number(rsWindow), rocWindow: Number(rocWindow) };
    try {
      const res = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save settings' }));
        throw new Error(err.error || err.details || 'Failed to save settings');
      }
      localStorage.setItem(`defaults:${userId}`, JSON.stringify(payload));
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    }
  }, [interval, rsWindow, rocWindow]);

  const resetDefaults = useCallback(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
    const ls = userId ? localStorage.getItem(`defaults:${userId}`) : null;
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

  // Dynamic Options (same as main page)
  const rsOptions = useMemo(() => {
    if (interval === '1mo') {
      return [
        { label: '6 Bars', value: 6 },
        { label: '10 Bars', value: 10 },
        { label: '14 Bars (Std)', value: 14 },
        { label: '20 Bars', value: 20 }
      ];
    }
    if (interval === '1d') {
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
      return [
        { label: '1 Bar (Fast)', value: 1 },
        { label: '3 Bars', value: 3 },
        { label: '6 Bars', value: 6 }
      ];
    }
    if (interval === '1d') {
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
      const params = new URLSearchParams({ 
        sector: selectedSector,
        interval, 
        rsWindow, 
        rocWindow,
        benchmark
      });
      
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
      const res = await fetch(`/api/sector-stocks?${params.toString()}`, {
        headers: userId ? { 'x-user-id': userId } : {}
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error', details: 'No error details available' }));
        const errorMessage = errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`;
        console.error('API Error:', { status: res.status, statusText: res.statusText, errorData });
        throw new Error(errorMessage);
      }
      const json = await res.json();
      if (json.stocks) setData(json.stocks);
      if (json.config) setConfig(json.config);
      if (json.sector) setSectorName(json.sector);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSector, interval, rsWindow, rocWindow, backtestDate, benchmark]);

  useEffect(() => { 
    fetchData(); 
    // Update URL
    router.push(`/sectors?sector=${selectedSector}`, { scroll: false });
  }, [selectedSector, fetchData]);

  // Initialize selected stocks to all fetched stock names when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      setSelectedStocks(new Set(data.map((s: any) => s.name)));
    } else {
      setSelectedStocks(new Set());
    }
  }, [data]);

  const handleSectorChange = (newSector: string) => {
    setSelectedSector(newSector);
    // Update sector name immediately based on the sector symbol
    const sectorInfo = SECTOR_INDICES.find(s => s.symbol === newSector);
    if (sectorInfo) {
      setSectorName(sectorInfo.name);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 md:p-8 pb-20">
      
      {/* SECTOR SELECTOR BAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 min-w-48">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Sector: {sectorName}</h2>
                  <p className="text-xs text-slate-500">Select sector and configure parameters</p>
                </div>
              </div>
              
              {/* First row: sector + date + intervals + RS + ROC */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full relative z-40">
                <CustomSelect 
                  label="Select Sector" 
                  icon={<TrendingUp className="w-3.5 h-3.5" />} 
                  value={selectedSector} 
                  onChange={handleSectorChange} 
                  options={SECTOR_INDICES.map(s => ({ label: s.name, value: s.symbol }))} 
                />
                <CustomSelect label="Backtest Date" icon={<History className="w-3.5 h-3.5" />} value={backtestDate} onChange={setBacktestDate} options={[]} isDate />
                <CustomSelect label="Interval" icon={<Calendar className="w-3.5 h-3.5" />} value={interval} onChange={setIntervalState} options={INTERVAL_OPTIONS} />
                <CustomSelect label="RS Period" icon={<BarChart3 className="w-3.5 h-3.5" />} value={rsWindow} onChange={setRsWindow} options={rsOptions} />
                <CustomSelect label="ROC Period" icon={<Clock className="w-3.5 h-3.5" />} value={rocWindow} onChange={setRocWindow} options={rocOptions} />
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Actions:</label>
                <button onClick={saveDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Save Settings</button>
                <button onClick={resetDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Reset to Defaults</button>
              </div>
            </div>

            {/* Second row: Stocks multiselect + Benchmark toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full relative z-40">
              {/* Stocks Multiselect */}
              <div className="flex flex-col gap-1.5 w-full relative">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Stocks
                </label>
                <button
                  onClick={() => setShowStockDropdown(!showStockDropdown)}
                  className="w-full bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 h-11 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500 cursor-pointer flex items-center justify-between"
                >
                  <span className="text-xs">{selectedStocks.size} of {data.length}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showStockDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showStockDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto" style={{ zIndex: 999 }}>
                    {data.map((stock: any) => (
                      <label key={stock.name} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedStocks.has(stock.name)}
                          onChange={(e) => {
                            const next = new Set(selectedStocks);
                            if (e.target.checked) next.add(stock.name); else next.delete(stock.name);
                            setSelectedStocks(next);
                          }}
                          className="w-4 h-4 rounded border-slate-600 accent-blue-600 cursor-pointer"
                        />
                        <span className="text-xs text-slate-300">{stock.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Benchmark Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Benchmark</label>
                <div className="w-full flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 h-11">
                  <button
                    onClick={() => setBenchmark('sector')}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap ${
                      benchmark === 'sector'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sector
                  </button>
                  <div className="w-px h-3 bg-slate-600"></div>
                  <button
                    onClick={() => setBenchmark('nifty')}
                    className={`pl-3 ${
                      benchmark === 'nifty'
                        ? 'pr-4 bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                        : 'pr-3 text-slate-400 hover:text-slate-200'
                    } py-1.5 rounded text-xs font-semibold transition-all whitespace-nowrap`}
                  >
                    NIFTY 50
                  </button>
                </div>
              </div>
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
            <p className="text-slate-300 text-sm font-bold animate-pulse relative z-10">Analyzing {sectorName} Stocks...</p>
            <p className="text-slate-500 text-xs mt-2 relative z-10">
                {backtestDate ? `Fetching history for ${backtestDate}` : 'Fetching live market data'}
            </p>
          </div>
        ) : (
          <>
            <RRGChart 
              data={data} 
              interval={interval} 
              config={config} 
              benchmark={benchmark === 'nifty' ? 'NIFTY 50' : sectorName} 
              enableSectorNavigation={false} 
              selectedSectorNames={selectedStocks}
              onStockHover={(stockName) => {
                setHoveredStock(stockName);
                setShowStockChart(!!stockName);
              }}
            />
            {hoveredStock && (
              <StockPriceChart 
                stockName={hoveredStock} 
                isOpen={showStockChart} 
                onClose={() => {
                  setShowStockChart(false);
                  setHoveredStock(null);
                }}
              />
            )}
          </>
        )}
      </div>

      {selectedStocks.size > 0 && (
        <div className="max-w-7xl mx-auto mb-12">
          <MovementHighlights 
            data={displayedStocks as any} 
            subjectLabel="stock" 
          />
        </div>
      )}

    </main>
  );
}

function CustomSelect({ label, icon, value, onChange, options, isDate = false }: any) {
  if (isDate) {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
          {icon} {label}
        </label>
        <input 
          type="date" 
          max={new Date().toISOString().split("T")[0]}
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500 cursor-pointer"
        />
      </div>
    );
  }
  
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

export default function SectorsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 md:p-8 pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-slate-400">Loading sector analysis...</p>
        </div>
      </div>
    }>
      <SectorsPageContent />
    </Suspense>
  );
}
