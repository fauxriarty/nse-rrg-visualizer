'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea, Label
} from 'recharts';
import { useMemo } from 'react';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; 
    
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs z-50">
        <span className="font-bold text-white block mb-1">{data.name}</span>
        <span className="text-slate-400">Trend: {data.x.toFixed(2)} | Mom: {data.y.toFixed(2)}</span>
      </div>
    );
  }
  return null;
};

export default function RRGChart({ data }: { data: any[] }) {
  
  // 1. Flatten data AND explicitly capture the index for stable label positioning
  const chartData = useMemo(() => {
    return data.map((sector, index) => ({
      x: sector.head.x,
      y: sector.head.y,
      name: sector.name,
      originalIndex: index, // Pass the index explicitly to the payload
    }));
  }, [data]);

  const { domain, ticks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { domain: [98, 102], ticks: [98, 99, 100, 101, 102] };
    }

    let maxDiff = 0;
    data.forEach(item => {
      const diffX = Math.abs(item.head.x - 100);
      const diffY = Math.abs(item.head.y - 100);
      maxDiff = Math.max(maxDiff, diffX, diffY);
    });

    const buffer = Math.ceil(maxDiff) + 1;
    const safeBuffer = Math.max(buffer, 2);
    const min = 100 - safeBuffer;
    const max = 100 + safeBuffer;

    const generatedTicks = [];
    for (let i = min; i <= max; i++) {
      generatedTicks.push(i);
    }

    return { domain: [min, max], ticks: generatedTicks };
  }, [data]);

  // Determine responsive sizes based on window width
  const getResponsiveSizes = () => {
    if (typeof window === 'undefined') {
      return { quadrantFontSize: 24, pointRadius: 6, labelFontSize: 10 };
    }
    
    const width = window.innerWidth;
    
    if (width < 640) { // Mobile
      return { quadrantFontSize: 14, pointRadius: 4, labelFontSize: 8 };
    } else if (width < 1024) { // Tablet
      return { quadrantFontSize: 18, pointRadius: 5, labelFontSize: 9 };
    } else { // Desktop
      return { quadrantFontSize: 24, pointRadius: 6, labelFontSize: 10 };
    }
  };

  const sizes = getResponsiveSizes();

  return (
    // Responsive height: smaller on mobile, grows on larger screens
    <div className="w-full h-80 sm:h-120 md:h-150 rounded-xl border border-slate-800 bg-[#0B1121] overflow-hidden shadow-xl">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          
          {/* --- QUADRANT BACKGROUNDS --- */}
          <ReferenceArea x1={domain[0]} x2={100} y1={100} y2={domain[1]} fill="#1e3a8a" fillOpacity={0.3}>
            <Label value="IMPROVING" position="center" fill="rgba(59, 130, 246, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domain[1]} y1={100} y2={domain[1]} fill="#064e3b" fillOpacity={0.3}>
            <Label value="LEADING" position="center" fill="rgba(16, 185, 129, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={domain[0]} x2={100} y1={domain[0]} y2={100} fill="#7f1d1d" fillOpacity={0.3}>
            <Label value="LAGGING" position="center" fill="rgba(239, 68, 68, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domain[1]} y1={domain[0]} y2={100} fill="#78350f" fillOpacity={0.3}>
            <Label value="WEAKENING" position="center" fill="rgba(245, 158, 11, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>

          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis type="number" dataKey="x" domain={domain} ticks={ticks} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0}>
             <Label value="Relative Trend (RS-Ratio)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} />
          </XAxis>
          <YAxis type="number" dataKey="y" domain={domain} ticks={ticks} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0}>
            <Label value="Momentum (ROC)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={11} />
          </YAxis>

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#fff' }} />
          
          <ReferenceLine x={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />
          <ReferenceLine y={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />

          {/* --- DATA POINTS --- */}
          <Scatter
            name="Sectors"
            data={chartData}
            fill="#ffffff"
            shape={(props: any) => {
              const { cx, cy, payload, ...restProps } = props;
              
              // Use the explicitly captured index from the payload
              const isEven = payload.originalIndex % 2 === 0;
              const labelXOffset = isEven ? 12 : -12;
              const textAnchor = isEven ? 'start' : 'end';

              return (
                <g {...restProps} className="cursor-pointer hover:brightness-125">
                  <circle cx={cx} cy={cy} r={sizes.pointRadius} fill="#ffffff" stroke="#000000" strokeWidth={2} />
                  <text 
                    x={cx + labelXOffset} 
                    y={cy + 4} 
                    textAnchor={textAnchor}
                    fill="#e2e8f0" 
                    fontSize={sizes.labelFontSize} 
                    fontWeight="600" 
                    style={{ textShadow: '1px 1px 2px #000', pointerEvents: 'none' }}
                  >
                    {payload.name}
                  </text>
                </g>
              );
            }}
          />

        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}