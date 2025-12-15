'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import RRGChart from '@/components/RRGChart';
import Navigation from '@/components/Navigation';
import { 
  RefreshCw, Activity, BarChart3, Calendar, ChevronDown, 
  Clock, SlidersHorizontal, History, TrendingUp
} from 'lucide-react';
import { SECTOR_INDICES } from '@/lib/sectorConfig';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

function SectorsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [sectorName, setSectorName] = useState('');

  // Configuration State
  const [selectedSector, setSelectedSector] = useState(() => {
    return searchParams.get('sector') || '^NSEBANK';
  });
  const [interval, setIntervalState] = useState('1d');
  const [rsWindow, setRsWindow] = useState('14');
  const [rocWindow, setRocWindow] = useState('14');
  const [backtestDate, setBacktestDate] = useState(new Date().toISOString().split('T')[0]);

  // Initialize sector name when selected sector changes
  useEffect(() => {
    const sectorInfo = SECTOR_INDICES.find(s => s.symbol === selectedSector);
    if (sectorInfo) {
      setSectorName(sectorInfo.name);
    }
  }, [selectedSector]);

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
        rocWindow 
      });
      
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const res = await fetch(`/api/sector-stocks?${params.toString()}`);
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
  }, [selectedSector, interval, rsWindow, rocWindow, backtestDate]);

  useEffect(() => { 
    fetchData(); 
    // Update URL
    router.push(`/sectors?sector=${selectedSector}`, { scroll: false });
  }, [selectedSector, fetchData]);

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
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Market<span className="text-blue-500">RRG</span></h1>
            <p className="text-slate-400 text-xs sm:text-sm font-medium">Sector Stock Analysis</p>
          </div>
        </div>
        
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 w-full sm:w-auto sm:justify-end">
           <Navigation />
           
           <div className="flex gap-2 justify-end">
             {backtestDate && backtestDate !== new Date().toISOString().split('T')[0] && (
               <button 
                  onClick={() => setBacktestDate(new Date().toISOString().split('T')[0])}
                  className="px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-all border border-slate-700"
               >
                 Reset to Live
               </button>
             )}
             <button onClick={fetchData} disabled={loading} className="flex justify-center items-center gap-2 px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs sm:text-sm font-bold text-white transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
               <RefreshCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
               {loading ? 'Calculating...' : 'Update Chart'}
             </button>
           </div>
        </div>
      </header>

      {/* SECTOR SELECTOR BAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-3 min-w-48">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white">Sector: {sectorName}</h2>
                <p className="text-xs text-slate-500">Select sector and configure parameters</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 w-full lg:w-auto">
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
          <RRGChart data={data} interval={interval} config={config} benchmark={sectorName} enableSectorNavigation={false} />
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
