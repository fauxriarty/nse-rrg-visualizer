'use client';

import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ReferenceArea, Label, LabelList
} from 'recharts';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { SECTOR_INDICES } from '@/lib/sectorConfig';

interface RRGChartProps {
  data: any[];
  interval?: string;
  config?: {
    interval: string;
    rsWindow: number;
    rocWindow: number;
    backtestDate?: string;
  };
  benchmark?: string; // Optional benchmark name (defaults to NIFTY 50)
  enableSectorNavigation?: boolean; // Enable clicking sectors to navigate
  selectedSectorNames?: Set<string>; // Filter which sectors to display (optional)
}

const generateSmartTicks = (min: number, max: number, zoomLevel: number = 1) => {
  const range = max - min;
  const targetTicks = 5; // Target 5 ticks for clean grid
  const rawStep = range / targetTicks; 
  
  // Choose nice step sizes; multiply by zoom to space ticks further when zoomed in
  const niceSteps = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const zoomMultiplier = Math.max(1, Math.ceil(zoomLevel * 0.4));
  const adjustedNiceSteps = niceSteps.map(s => s * zoomMultiplier);
  let step = adjustedNiceSteps.find(s => s >= rawStep) || Math.ceil(rawStep);

  const ticks = [];
  let start = Math.ceil(min / step) * step;
  for (let i = start; i <= max; i += step) {
    ticks.push(parseFloat(i.toFixed(1)));
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

export default function RRGChart({ data, interval = '1wk', config, benchmark = 'NIFTY 50', enableSectorNavigation = true, selectedSectorNames }: RRGChartProps) {
  
  const router = useRouter();
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Filter data for rendering if selectedSectorNames is provided
  const displayData = useMemo(() => {
    if (!selectedSectorNames) return data;
    return data.filter(s => selectedSectorNames.has(s.name));
  }, [data, selectedSectorNames]);

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
    return displayData.map((sector, index) => ({
      x: sector.head.x,
      y: sector.head.y,
      name: sector.name,
      tail: sector.tail, 
      originalIndex: index, 
    }));
  }, [displayData]);

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
    // Track actual min/max across all points (heads + trails)
    let actualMinX = Infinity, actualMaxX = -Infinity;
    let actualMinY = Infinity, actualMaxY = -Infinity;

    if (data && data.length > 0) {
      data.forEach(item => {
        actualMinX = Math.min(actualMinX, item.head.x);
        actualMaxX = Math.max(actualMaxX, item.head.x);
        actualMinY = Math.min(actualMinY, item.head.y);
        actualMaxY = Math.max(actualMaxY, item.head.y);

        if (item.tail) {
          item.tail.forEach((t: any) => {
            actualMinX = Math.min(actualMinX, t.x);
            actualMaxX = Math.max(actualMaxX, t.x);
            actualMinY = Math.min(actualMinY, t.y);
            actualMaxY = Math.max(actualMaxY, t.y);
          });
        }
      });
    } else {
      actualMinX = 98; actualMaxX = 102;
      actualMinY = 98; actualMaxY = 102;
    }

    // Required half-range to include all points w.r.t. 100 axes
    const reqHalfRangeX = Math.max(100 - actualMinX, actualMaxX - 100);
    const reqHalfRangeY = Math.max(100 - actualMinY, actualMaxY - 100);
    const reqHalfRange = Math.max(reqHalfRangeX, reqHalfRangeY);

    // Base half-range with safety margin
    const epsilon = 0.6;
    const baseHalfRange = Math.ceil(reqHalfRange * 1.08) + 1;
    
    // Zoom reduces the half-range; always keep at least epsilon above required
    const zoomedHalfRange = baseHalfRange / zoomLevel;
    const effectiveHalfRange = Math.max(reqHalfRange + epsilon, zoomedHalfRange);

    const minX = 100 - effectiveHalfRange;
    const maxX = 100 + effectiveHalfRange;
    const minY = 100 - effectiveHalfRange;
    const maxY = 100 + effectiveHalfRange;

    const xData = generateSmartTicks(minX, maxX, zoomLevel);
    const yData = generateSmartTicks(minY, maxY, zoomLevel);

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

  // Reduce chart margins as we zoom in so the grid fills more of the box
  const chartMargin = useMemo(() => {
    const base = { top: 24, right: 20, bottom: 42, left: 44 };
    const scale = Math.min(3, Math.max(1, zoomLevel));
    return {
      // Keep safe minimums to prevent Y overflow/clipping on ticks and quadrant labels
      top: Math.max(18, Math.round(base.top / scale)),
      right: Math.max(10, Math.round(base.right / scale)),
      bottom: Math.max(28, Math.round(base.bottom / scale)),
      left: Math.max(24, Math.round(base.left / scale)),
    };
  }, [zoomLevel]);

  // --- HANDLERS ---
  const handleBackgroundClick = () => {
    setHoveredSector(null); // Click anywhere empty -> De-hover
  };

  const handlePointClick = (e: any, sectorName: string) => {
    e.stopPropagation(); // Stop the background click from immediately clearing this
    setHoveredSector(sectorName);
    
    // Navigate to sector analysis if enabled and it's a known sector
    if (enableSectorNavigation) {
      const sectorInfo = SECTOR_INDICES.find(s => s.name === sectorName);
      if (sectorInfo) {
        router.push(`/sectors?sector=${sectorInfo.symbol}`);
      }
    }
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
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end pointer-events-none gap-2">
        <div className="text-[10px] text-slate-500 bg-slate-950/80 px-2 py-1 rounded backdrop-blur-sm border border-slate-800/50">
          BENCHMARK: <span className="text-white font-bold">{benchmark}</span>
        </div>
        {hoveredSector && activeSectorData && (
          <div className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/20">
            <div>{hoveredSector}</div>
            <div>RS: {activeSectorData.x.toFixed(2)}</div>
            <div>ROC: {activeSectorData.y.toFixed(2)}</div>
          </div>
        )}
        <div className={`transition-all duration-300 ${hoveredSector ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
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
          margin={chartMargin}
          onMouseLeave={() => setHoveredSector(null)}
        >
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#60a5fa" />
            </marker>
          </defs>

          {/* QUADRANTS */}
          <ReferenceArea x1={domainX[0]} x2={100} y1={100} y2={domainY[1]} fill="#1e3a8a" fillOpacity={hoveredSector ? 0.05 : 0.3} style={{ pointerEvents: 'none' }}>
            <Label value="IMPROVING" position="center" fill="rgba(59, 130, 246, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} style={{ pointerEvents: 'none' }} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={100} y2={domainY[1]} fill="#064e3b" fillOpacity={hoveredSector ? 0.05 : 0.3} style={{ pointerEvents: 'none' }}>
            <Label value="LEADING" position="center" fill="rgba(16, 185, 129, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} style={{ pointerEvents: 'none' }} />
          </ReferenceArea>
          <ReferenceArea x1={domainX[0]} x2={100} y1={domainY[0]} y2={100} fill="#7f1d1d" fillOpacity={hoveredSector ? 0.05 : 0.3} style={{ pointerEvents: 'none' }}>
            <Label value="LAGGING" position="center" fill="rgba(239, 68, 68, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} style={{ pointerEvents: 'none' }} />
          </ReferenceArea>
          <ReferenceArea x1={100} x2={domainX[1]} y1={domainY[0]} y2={100} fill="#78350f" fillOpacity={hoveredSector ? 0.05 : 0.3} style={{ pointerEvents: 'none' }}>
            <Label value="WEAKENING" position="center" fill="rgba(245, 158, 11, 0.4)" fontSize={sizes.quadrantFontSize} fontWeight={900} style={{ pointerEvents: 'none' }} />
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