'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function StickyNavbar() {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const isMarketView = pathname === '/';
  const isSectorView = pathname.startsWith('/sectors');
  const isCustomView = pathname.startsWith('/custom');
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-slate-950 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4 min-w-fit">
          <div className="p-3.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black text-white tracking-tight">Market<span className="text-blue-500">RRG</span></h1>
            <p className="text-xs text-slate-500 font-medium">NSE Relative Rotation Graphs</p>
          </div>
        </div>

        {/* Navigation Links & Refresh */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-3">
            <Link 
              href="/"
              className={`flex items-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                isMarketView 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="hidden xs:inline">Market Overview</span>
              <span className="xs:hidden">Market</span>
            </Link>
            
            <Link 
              href="/sectors"
              className={`flex items-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                isSectorView 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="hidden xs:inline">Sector Analysis</span>
              <span className="xs:hidden">Sectors</span>
            </Link>

            <Link 
              href="/custom"
              className={`flex items-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-lg text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                isCustomView 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Target className="w-5 h-5" />
              <span className="hidden xs:inline">Custom Analysis</span>
              <span className="xs:hidden">Custom</span>
            </Link>
          </nav>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-4 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 rounded-lg text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
