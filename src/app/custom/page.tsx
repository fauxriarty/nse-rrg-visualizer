'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import RRGChart from '@/components/RRGChart';
import StockPriceChart from '@/components/StockPriceChart';
import MovementHighlights from '@/components/MovementHighlights';
import { 
  RefreshCw, Activity, BarChart3, Calendar, ChevronDown, 
  Clock, History, Target, Search, X, Plus, Save, Trash2, Play, Pause, TrendingUp
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

export default function CustomAnalysisPage() {
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'overview' | 'detail'>('detail');
  
  useEffect(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    setUserId(uid);
    if (!uid) {
      window.location.href = '/auth';
    }
  }, []);

  // Shared state
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showItemChart, setShowItemChart] = useState(false);

  // Detail mode state
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [benchmark, setBenchmark] = useState<'custom' | 'nifty'>('nifty');
  
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
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5); // minutes
  
  const intervalLabel = useMemo(() => interval === '1d' ? 'Daily' : interval === '1mo' ? 'Monthly' : 'Weekly', [interval]);

  // Load defaults for user
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

  // Dynamic Options
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

  const savedListOptions = useMemo(() => {
    return [
      { label: 'No Saved List', value: '' },
      ...savedLists.map((l: any) => ({ label: l.name, value: l.id }))
    ];
  }, [savedLists]);

  useEffect(() => {
    const validRs = rsOptions.map(o => o.value.toString());
    const validRoc = rocOptions.map(o => o.value.toString());
    if (!validRs.includes(rsWindow)) setRsWindow(validRs[validRs.length - 1]); 
    if (!validRoc.includes(rocWindow)) setRocWindow(validRoc[0]); 
  }, [interval, rsOptions, rocOptions, rsWindow, rocWindow]);

  const loadSavedLists = useCallback(async () => {
    try {
      const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
      const res = await fetch('/api/custom-lists', { headers: uid ? { 'x-user-id': uid } : {} });
      if (!res.ok) return;
      const json = await res.json();
      setSavedLists(json.lists || []);
    } catch (err) {
      console.error('Load saved lists error:', err);
    }
  }, []);

  useEffect(() => {
    loadSavedLists();
  }, [loadSavedLists]);

  // Fetch data for overview mode (all custom lists)
  const fetchOverviewData = useCallback(async () => {
    if (mode !== 'overview') return;
    
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ 
        interval, 
        rsWindow, 
        rocWindow,
      });
      
      if (backtestDate) {
        params.append('date', backtestDate);
      }

      const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
      const res = await fetch(`/api/custom-lists-index?${params.toString()}`, {
        headers: uid ? { 'x-user-id': uid } : {}
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error', details: 'No error details available' }));
        const errorMessage = errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(errorMessage);
      }
      const json = await res.json();
      setError(null);
      console.log('Overview data received:', json);
      if (json.lists) setData(json.lists);
      if (json.config) setConfig(json.config);
      console.log('Data set to:', json.lists);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error('Fetch error:', err);
      setError(errorMsg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [mode, interval, rsWindow, rocWindow, backtestDate]);

  // Fetch data for detail mode (single list stocks)
  const fetchDetailData = useCallback(async () => {
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
        benchmark
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
  }, [selectedStocks, interval, rsWindow, rocWindow, backtestDate, benchmark]);

  // Trigger fetches based on mode
  useEffect(() => {
    if (mode === 'overview') {
      fetchOverviewData();
    }
  }, [mode, fetchOverviewData]);

  useEffect(() => {
    if (mode === 'detail') {
      fetchDetailData();
    }
  }, [mode, fetchDetailData]);

  // Auto-refresh hook - disabled when backtesting
  const isBacktesting = backtestDate !== new Date().toISOString().split('T')[0];
  const fetchFn = mode === 'overview' ? fetchOverviewData : fetchDetailData;
  const memoizedFetchFn = useCallback(() => fetchFn(), [fetchFn]);
  const { lastRefreshTime, nextRefreshIn } = useAutoRefresh({
    onRefresh: memoizedFetchFn,
    enabled: autoRefreshEnabled && !isBacktesting,
    intervalSeconds: autoRefreshInterval * 60,
    shouldSkipBacktest: true,
    isBacktesting
  });

  // Handle stock search
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

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const addStock = useCallback(async (symbol: string) => {
    if (selectedStocks.includes(symbol)) return;
    setSelectedStocks((prev) => [...prev, symbol]);
    setSearchQuery('');
    setShowResults(false);

    if (selectedListId) {
      try {
        const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
        if (!uid) throw new Error('You must be logged in to modify saved lists');

        const res = await fetch('/api/custom-lists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
          body: JSON.stringify({ id: selectedListId, stock: symbol, add: true })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to add stock to list' }));
          throw new Error(err.error || err.details || 'Failed to add stock to list');
        }

        await loadSavedLists();
      } catch (err) {
        console.error('Add stock to list error:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to save to list');
      }
    }
  }, [selectedStocks, selectedListId, loadSavedLists, toast]);

  const removeStock = useCallback((symbol: string) => {
    setSelectedStocks(selectedStocks.filter(s => s !== symbol));
    setSelectedListId('');
  }, [selectedStocks]);

  const handleSelectSavedList = useCallback((listId: string) => {
    setSelectedListId(listId);
    if (!listId) return;
    const found = savedLists.find((l: any) => l.id === listId);
    if (found) {
      setSelectedStocks(found.stocks || []);
    }
  }, [savedLists]);

  const handleSaveList = useCallback(async () => {
    if (selectedStocks.length === 0) return;
    setSavingList(true);
    try {
      const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
      if (!uid) {
        throw new Error('You must be logged in to save lists');
      }
      const res = await fetch('/api/custom-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
        body: JSON.stringify({ name: saveName || 'My List', stocks: selectedStocks })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save list' }));
        throw new Error(err.error || err.details || 'Failed to save list');
      }
      const json = await res.json();
      setSavedLists(json.lists || []);
      if (json.list?.id) setSelectedListId(json.list.id);
      setShowSaveModal(false);
      setSaveName('');
      toast.success('List saved');
    } catch (err) {
      console.error('Save list error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save list');
    } finally {
      setSavingList(false);
    }
  }, [selectedStocks, saveName]);

  const requestDeleteList = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
    setShowSavedDropdown(false);
  }, []);

  const confirmDeleteList = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
      const res = await fetch(`/api/custom-lists?id=${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE', headers: uid ? { 'x-user-id': uid } : {} });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete list' }));
        throw new Error(err.error || 'Failed to delete list');
      }
      const json = await res.json();
      setSavedLists(json.lists || []);
      if (selectedListId === deleteTarget.id) {
        setSelectedListId('');
        setSelectedStocks([]);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete list error:', err);
    }
  }, [deleteTarget, selectedListId]);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6 md:p-8 pb-20">
      
      {/* MODE SELECTOR AND CONFIGURATION BAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col gap-6">
            {/* Mode Selector */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Custom Analysis</h2>
                  <p className="text-xs text-slate-500">Analyze custom lists as sectors or individual stocks</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('overview')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    mode === 'overview'
                      ? 'bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    View All Custom Lists
                  </span>
                </button>
                <button
                  onClick={() => setMode('detail')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    mode === 'detail'
                      ? 'bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Analyze Lists
                  </span>
                </button>
              </div>
            </div>

            {/* Configuration */}
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full relative z-40">
                <CustomSelect label="Backtest Date" icon={<History className="w-3.5 h-3.5" />} value={backtestDate} onChange={setBacktestDate} options={[]} isDate />
                <CustomSelect label="Interval" icon={<Calendar className="w-3.5 h-3.5" />} value={interval} onChange={setIntervalState} options={INTERVAL_OPTIONS} />
                <CustomSelect label="RS Period" icon={<BarChart3 className="w-3.5 h-3.5" />} value={rsWindow} onChange={setRsWindow} options={rsOptions} />
                <CustomSelect label="ROC Period" icon={<Clock className="w-3.5 h-3.5" />} value={rocWindow} onChange={setRocWindow} options={rocOptions} />
                {mode === 'detail' && (
                  <CustomSelect 
                    label="Benchmark" 
                    icon={<TrendingUp className="w-3.5 h-3.5" />} 
                    value={benchmark} 
                    onChange={setBenchmark} 
                    options={[
                      { label: 'NIFTY 50', value: 'nifty' },
                      { label: 'Custom Index', value: 'custom' }
                    ]} 
                  />
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Actions:</label>
                <button onClick={saveDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Save Settings</button>
                <button onClick={resetDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Reset to Defaults</button>
                
                {/* Auto-refresh section */}
                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      console.log('[CustomPage] Auto-refresh button clicked, current state:', autoRefreshEnabled);
                      setAutoRefreshEnabled(!autoRefreshEnabled);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border ${
                      autoRefreshEnabled && !isBacktesting
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                    title={isBacktesting ? 'Auto-refresh disabled while backtesting' : 'Toggle auto-refresh'}
                    disabled={isBacktesting}
                  >
                    {autoRefreshEnabled && !isBacktesting ? (
                      <>
                        <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Refreshing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Start Refresh</span>
                      </>
                    )}
                  </button>
                  
                  {autoRefreshEnabled && !isBacktesting && (
                    <>
                      <select
                        value={autoRefreshInterval}
                        onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value))}
                        className="px-2 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition cursor-pointer"
                      >
                        <option value={1}>1m</option>
                        <option value={5}>5m</option>
                        <option value={10}>10m</option>
                        <option value={15}>15m</option>
                      </select>
                      <div className="text-[9px] text-slate-400 whitespace-nowrap">
                        {lastRefreshTime && <div>Last: {lastRefreshTime.toLocaleTimeString()}</div>}
                        <div>Next: {Math.ceil(nextRefreshIn / 60)}m {nextRefreshIn % 60}s</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Detail Mode Controls */}
            {mode === 'detail' && (
              <div className="flex flex-col gap-3">
                {/* Saved Lists Dropdown */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Select Saved List
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowSavedDropdown(!showSavedDropdown)}
                      className="w-full bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded-lg px-3 py-2.5 flex items-center justify-between hover:border-slate-500 transition"
                    >
                      <span className="text-xs">
                        {selectedListId ? (savedLists.find((l: any) => l.id === selectedListId)?.name || 'Saved list') : 'No Saved List'}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSavedDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showSavedDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => { 
                            setSelectedListId(''); 
                            setSelectedStocks([]);
                            setShowSavedDropdown(false); 
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:bg-slate-800 border-b border-slate-800/50"
                        >
                          No Saved List (Manual Selection)
                        </button>
                        {savedLists.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-500">No saved lists</div>
                        )}
                        {savedLists.map((list: any) => (
                          <div key={list.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800 border-b border-slate-800/50 last:border-b-0">
                            <button
                              onClick={() => { handleSelectSavedList(list.id); setShowSavedDropdown(false); }}
                              className="text-left text-sm text-slate-200 font-semibold flex-1"
                            >
                              {list.name} <span className="text-xs text-slate-500">({list.stocks?.length || 0} stocks)</span>
                            </button>
                            <button
                              onClick={() => requestDeleteList(list.id, list.name)}
                              className="text-slate-500 hover:text-red-400"
                              title="Delete list"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock Search */}
                <div className="relative">
                  <div className="relative flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Search stocks to add (e.g., RELIANCE, TCS, INFY)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded-lg pl-10 pr-10 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-500"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      {searching && (
                        <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                      )}
                    </div>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      disabled={selectedStocks.length === 0}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all whitespace-nowrap ${
                        selectedStocks.length === 0
                          ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                          : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-lg shadow-blue-500/10'
                      }`}
                      title={selectedStocks.length === 0 ? 'Add at least one stock to save' : 'Save this list'}
                    >
                      <Save className="w-4 h-4" />
                      Save List
                    </button>
                  </div>

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
                        {selectedListId && (
                          <button
                            onClick={async () => {
                              try {
                                const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : '';
                                if (!uid) {
                                  throw new Error('You must be logged in to delete from lists');
                                }
                                const res = await fetch('/api/custom-lists', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json', 'x-user-id': uid },
                                  body: JSON.stringify({ id: selectedListId, stock: symbol })
                                });
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({ error: 'Failed to delete stock' }));
                                  throw new Error(err.error || err.details || 'Failed to delete stock from list');
                                }
                                setSelectedStocks((prev) => prev.filter((s) => s !== symbol));
                                await loadSavedLists();
                              } catch (err) {
                                console.error('Remove stock from list error:', err);
                                alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete stock'}`);
                              }
                            }}
                            className="hover:text-red-400 transition-colors"
                            title="Delete from saved list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Overview Mode Controls */}
            {mode === 'overview' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Saved Lists ({savedLists.length})
                  </label>
                  <p className="text-xs text-slate-400">
                    {savedLists.length === 0 ? 'No custom lists yet. Create some in Analyze Lists mode.' : `Showing all ${savedLists.length} custom lists as sectors with equal-weighted index calculated from constituent stocks`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save List Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 relative">
            <button
              onClick={() => setShowSaveModal(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Save className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Save Stock List</h3>
                <p className="text-xs text-slate-400">Give this list a name to reuse later</p>
              </div>
            </div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">List Name</label>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g., Momentum Picks"
              className="w-full mt-1 bg-slate-800 text-sm text-slate-200 border border-slate-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveList}
                disabled={savingList || selectedStocks.length === 0}
                className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-all flex items-center gap-2 ${
                  savingList || selectedStocks.length === 0
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-lg shadow-blue-500/10'
                }`}
              >
                {savingList ? 'Saving...' : 'Save List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5">
            <h3 className="text-white font-bold text-lg mb-2">Delete saved list?</h3>
            <p className="text-sm text-slate-300">This will remove "{deleteTarget.name}".</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteList}
                className="px-3 py-2 text-sm font-semibold rounded-lg border border-red-500 text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHART CONTAINER */}
      <div className="max-w-7xl mx-auto mb-16">
        {mode === 'overview' ? (
          // Overview mode content
          <>
            {savedLists.length === 0 ? (
              <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 border-dashed shadow-inner">
                <Target className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-400 text-lg font-bold mb-2">No Custom Lists</p>
                <p className="text-slate-500 text-sm">Switch to "Analyze List Stocks" to create your first custom list</p>
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
                <p className="text-slate-300 text-sm font-bold animate-pulse relative z-10">Analyzing Custom Lists...</p>
              </div>
            ) : data.length > 0 ? (
              <>
                <RRGChart 
                  data={data} 
                  interval={interval} 
                  config={config} 
                  benchmark="NIFTY 50" 
                  enableSectorNavigation={false}
                  onStockHover={(listName) => {
                    setHoveredItem(listName);
                    setShowItemChart(!!listName);
                  }}
                />
              </>
            ) : (
              <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <Activity className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-400 text-base font-bold mb-2">No Data Available</p>
                <p className="text-slate-500 text-sm">Unable to fetch data for custom lists</p>
              </div>
            )}
          </>
        ) : (
          // Detail mode content
          <>
            {selectedStocks.length === 0 ? (
              <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 border-dashed shadow-inner">
                <Target className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-400 text-lg font-bold mb-2">No List Selected</p>
                <p className="text-slate-500 text-sm">Select a saved list or search for stocks to start analyzing</p>
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
              <>
                <RRGChart 
                  data={data} 
                  interval={interval} 
                  config={config} 
                  benchmark={benchmark === 'custom' ? 'Custom Index' : 'NIFTY 50'} 
                  enableSectorNavigation={false}
                  onStockHover={(stockName) => {
                    setHoveredItem(stockName);
                    setShowItemChart(!!stockName);
                  }}
                />
                {hoveredItem && (
                  <StockPriceChart 
                    stockName={hoveredItem} 
                    isOpen={showItemChart} 
                    onClose={() => {
                      setShowItemChart(false);
                      setHoveredItem(null);
                    }}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-96 sm:h-125 md:h-150 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <Activity className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-400 text-base font-bold mb-2">No Data Available</p>
                <p className="text-slate-500 text-sm">Unable to fetch data for selected stocks</p>
              </div>
            )}
          </>
        )}
      </div>

      {mode === 'overview' && data.length > 0 && (
        <div className="max-w-7xl mx-auto mb-12">
          <MovementHighlights 
            data={data as any}
            subjectLabel="custom list"
          />
        </div>
      )}

      {mode === 'detail' && selectedStocks.length > 0 && (
        <div className="max-w-7xl mx-auto mb-12">
          <MovementHighlights 
            data={data as any}
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
