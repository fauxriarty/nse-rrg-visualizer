'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  
  const isMarketView = pathname === '/';
  const isSectorView = pathname.startsWith('/sectors');
  
  return (
    <nav className="flex items-center gap-2 flex-wrap justify-center">
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
    </nav>
  );
}
