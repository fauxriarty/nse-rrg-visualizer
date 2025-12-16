'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, TrendingUp, RefreshCw, Target } from 'lucide-react';

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
  showRefresh?: boolean;
  className?: string;
};

export default function Navigation({ onRefresh, refreshing = false, showRefresh = true, className = '' }: Props) {
  const pathname = usePathname();
  
  const isMarketView = pathname === '/';
  const isSectorView = pathname.startsWith('/sectors');
  const isCustomView = pathname.startsWith('/custom');
  
  return (
    <nav className={`flex items-center gap-2 flex-wrap justify-center w-full sm:w-auto ${className}`}>
      <Link 
        href="/"
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
          isMarketView 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        <BarChart3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        <span className="hidden xs:inline">Market Overview</span>
        <span className="xs:hidden">Market</span>
      </Link>
      
      <Link 
        href="/sectors"
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
          isSectorView 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        <TrendingUp className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        <span className="hidden xs:inline">Sector Analysis</span>
        <span className="xs:hidden">Sectors</span>
      </Link>

      <Link 
        href="/custom"
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
          isCustomView 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        <Target className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
        <span className="hidden xs:inline">Custom Analysis</span>
        <span className="xs:hidden">Custom</span>
      </Link>

      {showRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={!onRefresh || refreshing}
          title="Update Chart"
          className={`inline-flex justify-center items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            refreshing ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
          }`}
        >
          <RefreshCw className={`w-3.5 sm:w-4 h-3.5 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">Update Chart</span>
        </button>
      )}
    </nav>
  );
}
