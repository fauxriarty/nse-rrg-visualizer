'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import RRGChart from '@/components/RRGChart';
import StockPriceChart from '@/components/StockPriceChart';
import { 
  RefreshCw, Activity, BarChart3, Calendar, ChevronDown, 
  Clock, History, Target, Search, X, Plus, Save, Trash2
} from 'lucide-react';
import { useToast } from '@/components/Toast';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
  { label: 'Monthly', value: '1mo' },
];

export default function CustomAnalysisPage() {
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
    useEffect(() => {
      const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      setUserId(uid);
      if (!uid) {
        window.location.href = '/auth';
      }
    }, []);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [hoveredStock, setHoveredStock] = useState<string | null>(null);
  const [showStockChart, setShowStockChart] = useState(false);
  
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
      setSelectedListId('');
    }
  }, [selectedStocks]);

  // Remove stock from analysis
  const removeStock = useCallback((symbol: string) => {
    setSelectedStocks(selectedStocks.filter(s => s !== symbol));
    setSelectedListId('');
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
      
      {/* SEARCH AND FILTERS BAR */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 min-w-48">
                <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Custom Analysis</h2>
                  <p className="text-xs text-slate-500">Search and add stocks vs NIFTY 50</p>
                </div>
              </div>
              
              {/* Filters row: saved list + date + intervals + RS + ROC */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full relative z-40">
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Saved Lists
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
                        {savedLists.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-500">No saved lists</div>
                        )}
                        {savedLists.map((list: any) => (
                          <div key={list.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800 border-b border-slate-800/50 last:border-b-0">
                            <button
                              onClick={() => { handleSelectSavedList(list.id); setShowSavedDropdown(false); }}
                              className="text-left text-sm text-slate-200 font-semibold flex-1"
                            >
                              {list.name}
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
                <CustomSelect label="Backtest Date" icon={<History className="w-3.5 h-3.5" />} value={backtestDate} onChange={setBacktestDate} options={[]} isDate />
                <CustomSelect label="Interval" icon={<Calendar className="w-3.5 h-3.5" />} value={interval} onChange={setIntervalState} options={INTERVAL_OPTIONS} />
                <CustomSelect label="RS Period" icon={<BarChart3 className="w-3.5 h-3.5" />} value={rsWindow} onChange={setRsWindow} options={rsOptions} />
                <CustomSelect label="ROC Period" icon={<Clock className="w-3.5 h-3.5" />} value={rocWindow} onChange={setRocWindow} options={rocOptions} />
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Actions:</label>
                <button onClick={saveDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Save Settings</button>
                <button onClick={resetDefaults} className="px-3 py-1.5 bg-slate-900 text-xs sm:text-sm text-slate-200 border border-slate-700 rounded-lg hover:border-slate-500 transition whitespace-nowrap">Reset to Defaults</button>
              </div>
            </div>

            {/* Stock Search Bar + Save */}
            <div className="flex flex-col gap-3">
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
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
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
                              // Update saved lists state and selectedStocks
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
                <p className="text-xs text-slate-400">Give this list a name to reuse later (saved per IP)</p>
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
            <p className="text-sm text-slate-300">This will remove "{deleteTarget.name}" for your IP.</p>
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
          <>
            <RRGChart 
              data={data} 
              interval={interval} 
              config={config} 
              benchmark="NIFTY 50" 
              enableSectorNavigation={false}
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
