'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import RRGChart from '@/components/RRGChart';
import Navigation from '@/components/Navigation';
import { 
  RefreshCw, Activity, BarChart3, Calendar, ChevronDown, 
  Clock, History, Target, Search, X, Plus
} from 'lucide-react';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

export default function CustomAnalysisPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Configuration State
  const [interval, setIntervalState] = useState('1d');
  const [rsWindow, setRsWindow] = useState('14');
  const [rocWindow, setRocWindow] = useState('14');
  const [backtestDate, setBacktestDate] = useState(new Date().toISOString().split('T')[0]);

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

  // Search stocks
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
        setShowResults(true);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Add stock to analysis
  const addStock = useCallback((symbol: string) => {
    if (!selectedStocks.includes(symbol)) {
      setSelectedStocks([...selectedStocks, symbol]);
      setSearchQuery('');
      setShowResults(false);
    }
  }, [selectedStocks]);

  // Remove stock from analysis
  const removeStock = useCallback((symbol: string) => {
    setSelectedStocks(selectedStocks.filter(s => s !== symbol));
  }, [selectedStocks]);

  // Fetch data for selected stocks
  const fetchData = useCallback(async () => {
    if (selectedStocks.length === 0) {
      setData([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ 
        stocks: selectedStocks.join(','),
        interval, 
        rsWindow, 
        rocWindow,
      });
      
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const res = await fetch(`/api/stocks/custom?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error', details: 'No error details available' }));
        const errorMessage = errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`;
        console.error('API Error:', { status: res.status, statusText: res.statusText, errorData });
        setError(errorMessage);
        setData([]);
        return;
      }
      const json = await res.json();
      setError(null);
      if (json.stocks) setData(json.stocks);
      if (json.config) setConfig(json.config);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error('Fetch error:', err);
      setError(errorMsg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStocks, interval, rsWindow, rocWindow, backtestDate]);

  useEffect(() => { 
    fetchData(); 
  }, [selectedStocks, interval, rsWindow, rocWindow, backtestDate]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 md:p-8 pb-20">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Market<span className="text-blue-500">RRG</span></h1>
            <p className="text-slate-400 text-xs sm:text-sm font-medium">Custom Stock Analysis</p>
          </div>
        </div>
        
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 w-full sm:w-auto sm:justify-end mt-2 sm:mt-0">
           <Navigation onRefresh={fetchData} refreshing={loading} />

           <div className="flex gap-2 justify-end">
             {backtestDate && backtestDate !== new Date().toISOString().split('T')[0] && (
               <button 
                  onClick={() => setBacktestDate(new Date().toISOString().split('T')[0])}
                  className="px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-all border border-slate-700"
               >
                 Reset to Live
               </button>
             )}
           </div>
        </div>
      </header>

      {/* SEARCH AND FILTERS BAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-3 min-w-48">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Custom Analysis</h2>
                  <p className="text-xs text-slate-500">Search and add stocks vs NIFTY 50</p>
                </div>
              </div>
              
              {/* Filters row: date + intervals + RS + ROC */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto relative z-40">
                <CustomSelect label="Backtest Date" icon={<History className="w-3.5 h-3.5" />} value={backtestDate} onChange={setBacktestDate} options={[]} isDate />
                <CustomSelect label="Interval" icon={<Calendar className="w-3.5 h-3.5" />} value={interval} onChange={setIntervalState} options={INTERVAL_OPTIONS} />
                <CustomSelect label="RS Period" icon={<BarChart3 className="w-3.5 h-3.5" />} value={rsWindow} onChange={setRsWindow} options={rsOptions} />
                <CustomSelect label="ROC Period" icon={<Clock className="w-3.5 h-3.5" />} value={rocWindow} onChange={setRocWindow} options={rocOptions} />
              </div>
            </div>

            {/* Stock Search Bar */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search stocks to add (e.g., RELIANCE, TCS, INFY)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  {searching && (
                    <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    {searchResults.map((stock: any) => (
                      <button
                        key={stock.symbol}
                        onClick={() => addStock(stock.symbol)}
                        disabled={selectedStocks.includes(stock.symbol)}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-b-0 transition-colors ${
                          selectedStocks.includes(stock.symbol) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-semibold text-slate-200">{stock.symbol}</span>
                          <span className="text-xs text-slate-400">{stock.name}</span>
                        </div>
                        {selectedStocks.includes(stock.symbol) ? (
                          <span className="text-xs text-slate-500">Added</span>
                        ) : (
                          <Plus className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Stocks Pills */}
              {selectedStocks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedStocks.map((symbol) => (
                    <div
                      key={symbol}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300"
                    >
                      <span className="font-semibold">{symbol}</span>
                      <button
                        onClick={() => removeStock(symbol)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="max-w-7xl mx-auto mb-16">
        {selectedStocks.length === 0 ? (
          <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 border-dashed shadow-inner">
            <Target className="w-16 h-16 text-slate-700 mb-4" />
            <p className="text-slate-400 text-lg font-bold mb-2">No Stocks Selected</p>
            <p className="text-slate-500 text-sm">Search and add stocks above to start analyzing</p>
          </div>
        ) : error ? (
          <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-red-950/10 border border-red-900/30 rounded-2xl shadow-inner">
            <div className="text-red-400 text-center">
              <p className="text-lg font-bold mb-2">Error Loading Data</p>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-inner relative overflow-hidden">
             <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-4 relative z-10" />
            <p className="text-slate-300 text-sm font-bold animate-pulse relative z-10">Analyzing Selected Stocks...</p>
            <p className="text-slate-500 text-xs mt-2 relative z-10">
                {backtestDate ? `Fetching history for ${backtestDate}` : 'Fetching live market data'}
            </p>
          </div>
        ) : data.length > 0 ? (
          <RRGChart 
            data={data} 
            interval={interval} 
            config={config} 
            benchmark="NIFTY 50" 
            enableSectorNavigation={false} 
          />
        ) : (
          <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
            <Activity className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-slate-400 text-base font-bold mb-2">No Data Available</p>
            <p className="text-slate-500 text-sm">Unable to fetch data for selected stocks</p>
          </div>
        )}
      </div>

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
