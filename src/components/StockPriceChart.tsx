'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Loader2 } from 'lucide-react';

interface PriceData {
  date: string;
  close: number;
  high: number;
  low: number;
}

interface StockPriceChartProps {
  stockName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StockPriceChart({ stockName, isOpen, onClose }: StockPriceChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !stockName) return;

    const fetchPriceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stock-price?symbol=${encodeURIComponent(stockName)}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch price data: ${res.status}`);
        }
        const json = await res.json();
        setData(json.prices || []);
      } catch (err: any) {
        console.error('Price fetch error:', err);
        setError(err.message || 'Failed to fetch price data');
      } finally {
        setLoading(false);
      }
    };

    fetchPriceData();
  }, [isOpen, stockName]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-4 z-40 w-[360px] sm:w-[420px] pointer-events-auto">
      <div className="bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wide">3M Price</span>
            <h2 className="text-sm font-bold text-white leading-tight">{stockName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            title="Hide"
          >
            <X className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <p className="text-slate-400 text-xs">Loading price data...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <p className="text-red-400 font-semibold text-sm">{error}</p>
              <p className="text-slate-400 text-xs">Symbol might be unavailable</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 40, bottom: 40 }}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#1e293b" 
                  opacity={0.5}
                  horizontal
                  vertical
                />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickLine={{ stroke: '#475569' }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickLine={{ stroke: '#475569' }}
                  domain={['dataMin - 20', 'dataMax + 20']}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #0ea5e9',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.25)'
                  }}
                  cursor={{ stroke: '#0ea5e9', strokeWidth: 1, opacity: 0.4 }}
                  formatter={(value) => `₹${(value as number).toFixed(2)}`}
                  labelFormatter={(label) => label}
                  wrapperStyle={{ outline: 'none' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#0ea5e9" 
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive={false}
                  name="Close"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-slate-400 text-xs">No price data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
