'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, TrendingUp, Target, RefreshCw, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function StickyNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  
  const isMarketView = pathname === '/';
  const isSectorView = pathname.startsWith('/sectors');
  const isCustomView = pathname.startsWith('/custom');
  
  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  useEffect(() => {
    const name = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    setUsername(name);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    window.location.href = '/auth';
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-950 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-2">
          {/* Left: logo */}
          <div className="flex items-center gap-2 min-w-fit pl-2 sm:pl-0">
            <div className="p-2 sm:p-3 bg-blue-600 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">Market<span className="text-blue-500">RRG</span></h1>
              <p className="text-xs text-slate-500 font-medium">NSE Relative Rotation Graphs</p>
            </div>
          </div>

          {/* Right: nav + controls */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {/* Mobile menu select */}
            <div className="flex sm:hidden w-32">
              <select
                className="w-full bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg px-2 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={pathname.startsWith('/custom') ? '/custom' : pathname.startsWith('/sectors') ? '/sectors' : '/'}
                onChange={(e) => router.push(e.target.value)}
              >
                <option value="/">Market</option>
                <option value="/sectors">Sectors</option>
                <option value="/custom">Custom</option>
              </select>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-2.5">
              <Link 
                href="/"
                className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-lg text-sm md:text-base font-semibold transition-all whitespace-nowrap ${
                  isMarketView 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Market Overview</span>
              </Link>
              
              <Link 
                href="/sectors"
                className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-lg text-sm md:text-base font-semibold transition-all whitespace-nowrap ${
                  isSectorView 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Sector Analysis</span>
              </Link>

              <Link 
                href="/custom"
                className={`flex items-center gap-2 px-4 md:px-5 py-2 rounded-lg text-sm md:text-base font-semibold transition-all whitespace-nowrap ${
                  isCustomView 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>Custom Analysis</span>
              </Link>
            </nav>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-slate-200 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* User / Login */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {username ? (
                <div className="flex items-center gap-1 bg-slate-800 text-slate-200 rounded-lg px-2 sm:px-3 py-1.5 min-w-0">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="hidden sm:inline text-sm font-semibold max-w-32 truncate">{username}</span>
                  <span className="sm:hidden text-xs font-semibold max-w-16 truncate">{username}</span>
                  <button
                    onClick={handleLogout}
                    className="ml-1 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors shrink-0"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link href="/auth" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs sm:text-sm md:text-base font-semibold transition-all whitespace-nowrap">Login</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
