'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceArea, Label
} from 'recharts';
import { useMemo, useState, useEffect } from 'react';

interface RRGChartProps {
  data: any[];
}

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

// Helper to generate "Nice" ticks (avoids overcrowding)
const generateSmartTicks = (min: number, max: number) => {
  const range = max - min;
  const targetTickCount = 8; // Aim for roughly 8-10 ticks
  const rawStep = range / targetTickCount;
  
  // Find closest "nice" step: 0.5, 1, 2, 5, 10, 20...
  const niceSteps = [0.5, 1, 2, 5, 10, 20, 50];
  let step = niceSteps.find(s => s >= rawStep) || rawStep;

  const ticks = [];
  // Start from a multiple of step just below min
  let start = Math.floor(min / step) * step;
  
  for (let i = start; i <= max; i += step) {
    if (i >= min && i <= max) {
      ticks.push(parseFloat(i.toFixed(1)));
    }
  }
  return { domain: [min, max], ticks };
};

export default function RRGChart({ data }: RRGChartProps) {
  
  // 1. Flatten data
  const chartData = useMemo(() => {
    return data.map((sector, index) => ({
      x: sector.head.x,
      y: sector.head.y,
      name: sector.name,
      originalIndex: index, 
    }));
  }, [data]);

  // 2. SCALING LOGIC (FIXED FOR MONTHLY/WIDE RANGES)
  const { domainX, ticksX, domainY, ticksY } = useMemo(() => {
    if (!data || data.length === 0) {
      return { 
        domainX: [98, 102], ticksX: [98, 99, 100, 101, 102],
        domainY: [98, 102], ticksY: [98, 99, 100, 101, 102]
      };
    }

    let maxDiffX = 0;
    let maxDiffY = 0;

    data.forEach(item => {
      const diffX = Math.abs(item.head.x - 100);
      const diffY = Math.abs(item.head.y - 100);
      maxDiffX = Math.max(maxDiffX, diffX);
      maxDiffY = Math.max(maxDiffY, diffY);
    });

    // Add buffer (10% extra space)
    const bufferX = Math.ceil(maxDiffX * 1.1) + 1;
    const bufferY = Math.ceil(maxDiffY * 1.1) + 1;

    const minX = 100 - bufferX;
    const maxX = 100 + bufferX;
    const minY = 100 - bufferY;
    const maxY = 100 + bufferY;

    // Use Smart Ticks generator instead of simple loop
    const xData = generateSmartTicks(minX, maxX);
    const yData = generateSmartTicks(minY, maxY);

    return { 
      domainX: xData.domain, 
      ticksX: xData.ticks,
      domainY: yData.domain, 
      ticksY: yData.ticks
    };
  }, [data]);

  // 3. RESPONSIVE SIZES STATE
  const [sizes, setSizes] = useState({ 
    quadrantFontSize: 24, 
    pointRadius: 6, 
    labelFontSize: 10 
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) { // Mobile
        setSizes({ quadrantFontSize: 12, pointRadius: 4, labelFontSize: 8 });
      } else if (width < 1024) { // Tablet
        setSizes({ quadrantFontSize: 16, pointRadius: 5, labelFontSize: 9 });
      } else { // Desktop
        setSizes({ quadrantFontSize: 24, pointRadius: 6, labelFontSize: 10 });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full h-96 sm:h-[500px] md:h-[600px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart 
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
          data={chartData} 
        >
          
          {/* --- QUADRANTS --- */}
          {/* Note: We force the ReferenceAreas to fill the calculated domain */}
          <ReferenceArea x1={domainX[0]} x2={100} y1={100} y2={domainY[1]} fill="#1e3a8a" fillOpacity={0.3}>
            <Label value="IMPROVING" position="center" fill="rgba(59, 130, 246, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={100} y2={domainY[1]} fill="#064e3b" fillOpacity={0.3}>
            <Label value="LEADING" position="center" fill="rgba(16, 185, 129, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={domainX[0]} x2={100} y1={domainY[0]} y2={100} fill="#7f1d1d" fillOpacity={0.3}>
            <Label value="LAGGING" position="center" fill="rgba(239, 68, 68, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={domainY[0]} y2={100} fill="#78350f" fillOpacity={0.3}>
            <Label value="WEAKENING" position="center" fill="rgba(245, 158, 11, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>

          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          
          <XAxis 
            type="number" 
            dataKey="x" 
            domain={domainX} 
            ticks={ticksX} 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            interval={0}
          >
             <Label value="Relative Trend (RS-Ratio)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} />
          </XAxis>

          <YAxis 
            type="number" 
            dataKey="y" 
            domain={domainY} 
            ticks={ticksY} 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 10 }} 
            interval={0}
          >
            <Label value="Momentum (ROC)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={11} />
          </YAxis>

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#fff' }} />
          
          <ReferenceLine x={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />
          <ReferenceLine y={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.9} />

          {/* --- DATA POINTS --- */}
          <Scatter
            name="Sectors"
            fill="#ffffff"
            shape={(props: any) => {
              const { cx, cy, payload } = props;
              
              // Only pass valid DOM events
              const eventHandlers = {
                onMouseEnter: props.onMouseEnter,
                onMouseLeave: props.onMouseLeave,
                onClick: props.onClick,
              };
              
              const isEven = payload.originalIndex % 2 === 0;
              const labelXOffset = isEven ? 12 : -12;
              const textAnchor = isEven ? 'start' : 'end';

              return (
                <g {...eventHandlers} className="cursor-pointer hover:brightness-125">
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