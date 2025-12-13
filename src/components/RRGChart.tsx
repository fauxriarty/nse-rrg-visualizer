'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea, Label
} from 'recharts';
import { useMemo } from 'react';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const name = payload[0].name; 
    
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs z-50">
        <span className="font-bold text-white block mb-1">{name}</span>
        <span className="text-slate-400">Trend: {data.x.toFixed(2)} | Mom: {data.y.toFixed(2)}</span>
      </div>
    );
  }
  return null;
};

export default function RRGChart({ data }: { data: any[] }) {
  
  // --- TIGHT & SYMMETRIC SCALING LOGIC ---
  const { domain, ticks } = useMemo(() => {
    // Default view if no data
    if (!data || data.length === 0) {
      return { domain: [98, 102], ticks: [98, 99, 100, 101, 102] };
    }

    // 1. Find the furthest outlier from center (100)
    let maxDiff = 0;
    data.forEach(item => {
      const diffX = Math.abs(item.head.x - 100);
      const diffY = Math.abs(item.head.y - 100);
      maxDiff = Math.max(maxDiff, diffX, diffY);
    });

    // 2. Create a tight buffer. 
    // If max deviation is 1.2, we round up to 2 and add 1 for padding = 3.
    // This creates a range of 97 to 103.
    const buffer = Math.ceil(maxDiff) + 1;
    
    // Ensure we don't zoom in *too* much (minimum +/- 2)
    const safeBuffer = Math.max(buffer, 2);

    const min = 100 - safeBuffer;
    const max = 100 + safeBuffer;

    // 3. Generate Integer Ticks (e.g., 97, 98, 99, 100...)
    const generatedTicks = [];
    for (let i = min; i <= max; i++) {
      generatedTicks.push(i);
    }

    return { domain: [min, max], ticks: generatedTicks };
  }, [data]);

  return (
    <div className="w-full h-150 rounded-xl border border-slate-800 bg-[#0B1121] overflow-hidden shadow-xl">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
          
          {/* --- 1. QUADRANT BACKGROUNDS (Strong Opacity 0.3) --- */}
          
          {/* Improving (Top-Left) - Blue */}
          <ReferenceArea 
            x1={domain[0]} x2={100} y1={100} y2={domain[1]} 
            fill="#1e3a8a" fillOpacity={0.3} 
          >
            <Label value="IMPROVING" position="center" fill="rgba(59, 130, 246, 0.4)" fontSize={24} fontWeight={900} />
          </ReferenceArea>

          {/* Leading (Top-Right) - Green */}
          <ReferenceArea 
            x1={100} x2={domain[1]} y1={100} y2={domain[1]} 
            fill="#064e3b" fillOpacity={0.3} 
          >
            <Label value="LEADING" position="center" fill="rgba(16, 185, 129, 0.4)" fontSize={24} fontWeight={900} />
          </ReferenceArea>

          {/* Lagging (Bottom-Left) - Red */}
          <ReferenceArea 
            x1={domain[0]} x2={100} y1={domain[0]} y2={100} 
            fill="#7f1d1d" fillOpacity={0.3} 
          >
            <Label value="LAGGING" position="center" fill="rgba(239, 68, 68, 0.4)" fontSize={24} fontWeight={900} />
          </ReferenceArea>

          {/* Weakening (Bottom-Right) - Amber */}
          <ReferenceArea 
            x1={100} x2={domain[1]} y1={domain[0]} y2={100} 
            fill="#78350f" fillOpacity={0.3} 
          >
            <Label value="WEAKENING" position="center" fill="rgba(245, 158, 11, 0.4)" fontSize={24} fontWeight={900} />
          </ReferenceArea>

          {/* --- 2. GRID & AXES --- */}
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          
          <XAxis 
            type="number" 
            dataKey="x" 
            domain={domain} 
            ticks={ticks} // Uses tight integer ticks
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval={0} // Force show all calculated ticks
          >
             <Label value="Relative Trend (RS-Ratio)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={12} />
          </XAxis>

          <YAxis 
            type="number" 
            dataKey="y" 
            domain={domain}
            ticks={ticks} // Uses tight integer ticks
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval={0} // Force show all calculated ticks
          >
            <Label value="Momentum (ROC)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={12} />
          </YAxis>

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#fff' }} />
          
          {/* Center Crosshair */}
          <ReferenceLine x={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />
          <ReferenceLine y={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />

          {/* --- 3. DATA POINTS --- */}
          {data.map((sector, idx) => (
            <Scatter
              key={idx}
              name={sector.name}
              data={[sector.head]}
              fill="#22d3ee"
              shape={(props: any) => {
                const { cx, cy } = props;
                return (
                  <g className="cursor-pointer hover:brightness-125">
                    <circle cx={cx} cy={cy} r={6} fill="#22d3ee" stroke="#0B1121" strokeWidth={2} />
                    <text x={cx + 10} y={cy + 4} fill="#e2e8f0" fontSize={11} fontWeight="600" style={{ textShadow: '1px 1px 2px #000' }}>
                      {sector.name}
                    </text>
                  </g>
                );
              }}
            />
          ))}

        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}