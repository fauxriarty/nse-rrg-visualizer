'use client';

import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ReferenceArea, Label, LabelList
} from 'recharts';
import { useMemo, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface RRGChartProps {
  data: any[];
  interval?: string;
  config?: {
    interval: string;
    rsWindow: number;
    rocWindow: number;
    backtestDate?: string;
  };
}

const generateSmartTicks = (min: number, max: number) => {
  const range = max - min;
  const rawStep = range / 8; 
  const niceSteps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  let step = niceSteps.find(s => s >= rawStep) || rawStep;
  if (rawStep > 100) step = 100;

  const ticks = [];
  let start = Math.floor(min / step) * step;
  for (let i = start; i <= max; i += step) {
    if (i >= min && i <= max) ticks.push(parseFloat(i.toFixed(1)));
  }
  return { domain: [min, max], ticks };
};

const ABBREVIATIONS: { [key: string]: string } = {
  'IT': 'IT',
  'Bank': 'BK',
  'Auto': 'AU',
  'Metal': 'MT',
  'FMCG': 'FM',
  'Realty': 'RE',
  'PSU Bank': 'PB',
  'Energy': 'EN',
  'Infra': 'IN',
  'Pharma': 'PH',
  'Fin Serv': 'FS',
  'Nifty 200': 'N2',
  'Nifty 500': 'N5',
};

export default function RRGChart({ data, interval = '1wk', config }: RRGChartProps) {
  
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Get data for the manual tooltip box
  const activeSectorData = useMemo(() => {
    if (!hoveredSector) return null;
    const s = data.find(item => item.name === hoveredSector);
    return s ? s.head : null;
  }, [data, hoveredSector]);

  const intervalName = useMemo(() => {
    if (interval === '1d') return 'Days';
    if (interval === '1mo') return 'Months';
    return 'Weeks';
  }, [interval]);

  // Calculate dynamic trail length based on configuration
  const trailLength = useMemo(() => {
    return config?.rsWindow || 14;
  }, [config]);

  const chartData = useMemo(() => {
    return data.map((sector, index) => ({
      x: sector.head.x,
      y: sector.head.y,
      name: sector.name,
      tail: sector.tail, 
      originalIndex: index, 
    }));
  }, [data]);

  const trailData = useMemo(() => {
    if (!hoveredSector) return [];
    const sector = data.find(s => s.name === hoveredSector);
    return sector ? sector.tail : [];
  }, [data, hoveredSector]);

  const trailStart = useMemo(() => {
    if (trailData.length > 0) return [trailData[0]];
    return [];
  }, [trailData]);

  // SCALING & ZOOM LOGIC
  const { domainX, ticksX, domainY, ticksY } = useMemo(() => {
    let maxDiffX = 0;
    let maxDiffY = 0;

    if (data && data.length > 0) {
      data.forEach(item => {
        maxDiffX = Math.max(maxDiffX, Math.abs(item.head.x - 100));
        maxDiffY = Math.max(maxDiffY, Math.abs(item.head.y - 100));
        if(item.tail) {
          item.tail.forEach((t: any) => {
             maxDiffX = Math.max(maxDiffX, Math.abs(t.x - 100));
             maxDiffY = Math.max(maxDiffY, Math.abs(t.y - 100));
          });
        }
      });
    } else {
      maxDiffX = 2; maxDiffY = 2;
    }

    const bufferX = Math.ceil(maxDiffX * 1.1) + 1;
    const bufferY = Math.ceil(maxDiffY * 1.1) + 1;

    // Apply Zoom
    const effectiveBufferX = Math.max(1, bufferX / zoomLevel);
    const effectiveBufferY = Math.max(1, bufferY / zoomLevel);

    const minX = 100 - effectiveBufferX;
    const maxX = 100 + effectiveBufferX;
    const minY = 100 - effectiveBufferY;
    const maxY = 100 + effectiveBufferY;

    const xData = generateSmartTicks(minX, maxX);
    const yData = generateSmartTicks(minY, maxY);

    return { domainX: xData.domain, ticksX: xData.ticks, domainY: yData.domain, ticksY: yData.ticks };
  }, [data, zoomLevel]);

  const [sizes, setSizes] = useState({ quadrantFontSize: 24, pointRadius: 6, labelFontSize: 10 });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setSizes({ quadrantFontSize: 12, pointRadius: 4, labelFontSize: 8 });
      else if (width < 1024) setSizes({ quadrantFontSize: 16, pointRadius: 5, labelFontSize: 9 });
      else setSizes({ quadrantFontSize: 24, pointRadius: 6, labelFontSize: 10 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- HANDLERS ---
  const handleBackgroundClick = () => {
    setHoveredSector(null); // Click anywhere empty -> De-hover
  };

  const handlePointClick = (e: any, sectorName: string) => {
    e.stopPropagation(); // Stop the background click from immediately clearing this
    setHoveredSector(sectorName);
  };

  return (
    <div 
      className="w-full h-96 sm:h-125 md:h-150 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl relative group select-none outline-none"
      onClick={handleBackgroundClick}
      onMouseDown={(e) => e.preventDefault()}
      tabIndex={-1}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', outlineColor: 'transparent' } as React.CSSProperties}
    >
      
      {/* --- 1.  INFO BOX (Hidden unless hovering) --- */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end pointer-events-none">
        <div className="text-[10px] text-slate-500 bg-slate-950/80 px-2 py-1 rounded backdrop-blur-sm border border-slate-800/50">
          BENCHMARK: <span className="text-white font-bold">NIFTY 50</span>
        </div>
        <div className={`mt-1 transition-all duration-300 ${hoveredSector ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
           <div className="text-[10px] font-bold text-blue-400 bg-blue-950/40 px-2 py-1 rounded border border-blue-500/20 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              TRAIL: LAST {trailLength} {intervalName.toUpperCase()}
           </div>
        </div>
      </div>

      {/* --- 3. ZOOM CONTROLS (Bottom Right) --- */}
      <div 
        className="absolute bottom-4 right-4 z-20 flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()} // Prevent clicking buttons from clearing selection
      >
        <button 
          onClick={() => setZoomLevel(prev => Math.min(prev * 1.2, 5))}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-lg border border-slate-700 transition-colors active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setZoomLevel(1)}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg shadow-lg border border-slate-700 transition-colors active:scale-95"
          title="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setZoomLevel(prev => Math.max(prev / 1.2, 0.5))}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-lg border border-slate-700 transition-colors active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart 
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
          onMouseLeave={() => setHoveredSector(null)}
        >
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#60a5fa" />
            </marker>
          </defs>

          {/* QUADRANTS */}
          <ReferenceArea x1={domainX[0]} x2={100} y1={100} y2={domainY[1]} fill="#1e3a8a" fillOpacity={hoveredSector ? 0.05 : 0.3}>
            <Label value="IMPROVING" position="center" fill="rgba(59, 130, 246, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={100} y2={domainY[1]} fill="#064e3b" fillOpacity={hoveredSector ? 0.05 : 0.3}>
            <Label value="LEADING" position="center" fill="rgba(16, 185, 129, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={domainX[0]} x2={100} y1={domainY[0]} y2={100} fill="#7f1d1d" fillOpacity={hoveredSector ? 0.05 : 0.3}>
            <Label value="LAGGING" position="center" fill="rgba(239, 68, 68, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={domainY[0]} y2={100} fill="#78350f" fillOpacity={hoveredSector ? 0.05 : 0.3}>
            <Label value="WEAKENING" position="center" fill="rgba(245, 158, 11, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} />
          </ReferenceArea>

          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
          
          <XAxis type="number" dataKey="x" domain={domainX} ticks={ticksX} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0}>
             <Label value="Relative Trend (RS-Ratio)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} />
          </XAxis>

          <YAxis type="number" dataKey="y" domain={domainY} ticks={ticksY} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={0}>
            <Label value="Momentum (ROC)" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={11} />
          </YAxis>

          {/* NO RECHARTS TOOLTIP (Using custom Fixed Box instead) */}
          
          <ReferenceLine x={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.5} />
          <ReferenceLine y={100} stroke="#e2e8f0" strokeWidth={2} strokeOpacity={0.5} />

          {/* TRAIL LINE */}
          {hoveredSector && (
            <Line
              data={trailData}
              dataKey="y"
              type="monotone"
              stroke="#60a5fa"
              strokeWidth={3}
              dot={false}
              markerEnd="url(#arrowhead)"
              animationDuration={200}
              isAnimationActive={false}
            />
          )}

          {/* TRAIL START LABEL */}
          {hoveredSector && (
             <Scatter data={trailStart} fill="#60a5fa" r={4}>
                <LabelList valueAccessor={() => `Start`} position="top" offset={8} style={{ fill: '#60a5fa', fontSize: '10px', fontWeight: 'bold' }} />
             </Scatter>
          )}

          {/* SECTOR DOTS */}
          <Scatter 
            name="Sectors" 
            data={chartData} 
            fill="#ffffff"
            shape={(props: any) => {
              const { cx, cy, payload } = props;
              const { onMouseEnter, onClick } = props;
              
              const isHovered = hoveredSector === payload.name;
              const opacity = hoveredSector ? (isHovered ? 1 : 0.1) : 1; 
              
              // Alternate label positions: 0=left, 1=right
              const isLeft = payload.originalIndex % 2 === 0;
              const labelXOffset = isLeft ? -25 : 25;
              const labelYOffset = 4;
              const textAnchor: 'start' | 'middle' | 'end' = isLeft ? 'end' : 'start';

              return (
                <g 
                  onMouseEnter={() => {
                    setHoveredSector(payload.name);
                    if(onMouseEnter) onMouseEnter(props);
                  }}
                  onMouseLeave={() => {
                    if (hoveredSector === payload.name) {
                      setHoveredSector(null);
                    }
                  }}
                  onClick={(e) => handlePointClick(e, payload.name)}
                  className="cursor-pointer transition-all duration-300"
                  style={{ opacity }}
                >
                  {isHovered && <circle cx={cx} cy={cy} r={sizes.pointRadius * 3} fill="#60a5fa" opacity={0.2} />}
                  <circle cx={cx} cy={cy} r={sizes.pointRadius} fill={isHovered ? "#60a5fa" : "#ffffff"} stroke="#000000" strokeWidth={2} />
                  <text 
                    x={cx + labelXOffset} 
                    y={cy + labelYOffset} 
                    textAnchor={textAnchor} 
                    fill={isHovered ? "#60a5fa" : "#e2e8f0"} 
                    fontSize={isHovered ? sizes.labelFontSize + 2 : sizes.labelFontSize} 
                    fontWeight={isHovered ? "900" : "600"} 
                    style={{ textShadow: '1px 1px 2px #000', pointerEvents: 'none' }}
                  >
                    {payload.name}
                  </text>
                </g>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}