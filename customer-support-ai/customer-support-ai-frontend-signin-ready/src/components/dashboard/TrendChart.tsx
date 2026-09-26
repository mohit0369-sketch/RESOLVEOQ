import React, { useState } from 'react';

interface DataPoint {
  date: string;
  count: number;
  highlight?: boolean;
}

interface TrendChartProps {
  timeframe: '7D' | '30D' | '90D';
  onTimeframeChange: (tf: '7D' | '30D' | '90D') => void;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  timeframe,
  onTimeframeChange,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Data sets matching timeframes
  const dataSets: Record<'7D' | '30D' | '90D', DataPoint[]> = {
    '7D': [
      { date: 'Sep 19', count: 142 },
      { date: 'Sep 20', count: 168 },
      { date: 'Sep 21', count: 195 },
      { date: 'Sep 22', count: 210 },
      { date: 'Sep 23', count: 228 },
      { date: 'Sep 24', count: 245, highlight: true }, // Spike highlight
      { date: 'Sep 25', count: 260 },
    ],
    '30D': [
      { date: 'Day 1-5', count: 680 },
      { date: 'Day 6-10', count: 740 },
      { date: 'Day 11-15', count: 810 },
      { date: 'Day 16-20', count: 890 },
      { date: 'Day 21-25', count: 1040, highlight: true },
      { date: 'Day 26-30', count: 1284 },
    ],
    '90D': [
      { date: 'Jul W1', count: 420 },
      { date: 'Jul W3', count: 490 },
      { date: 'Aug W1', count: 580 },
      { date: 'Aug W3', count: 690 },
      { date: 'Sep W1', count: 910 },
      { date: 'Sep W3', count: 1284, highlight: true },
    ],
  };

  const points = dataSets[timeframe];
  const maxVal = Math.max(...points.map((p) => p.count)) * 1.15;
  const minVal = Math.min(...points.map((p) => p.count)) * 0.85;

  const width = 800;
  const height = 240;
  const padX = 40;
  const padY = 30;

  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const getCoordinates = (p: DataPoint, idx: number) => {
    const x = padX + (idx / (points.length - 1)) * chartW;
    const y = padY + chartH - ((p.count - minVal) / (maxVal - minVal)) * chartH;
    return { x, y };
  };

  const coords = points.map((p, i) => getCoordinates(p, i));

  // Build smooth bezier SVG path
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Area under path
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  return (
    <div className="space-y-4">
      {/* Timeframe selector header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-mono text-[#9a9a9a]">
            Complaint Volume Over Time
          </h3>
          <p className="text-xs text-[#bdbdbd] mt-0.5">
            Cross-channel volume tracking with cluster spike alert
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#222222] p-1 rounded-full text-xs">
          {(['7D', '30D', '90D'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 rounded-full font-mono text-[11px] transition-colors ${
                timeframe === tf
                  ? 'bg-[#8052ff] text-white font-medium'
                  : 'text-[#9a9a9a] hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden bg-[#000000] border border-[#1a1a1a] rounded-2xl p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8052ff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#8052ff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padX}
            y1={padY}
            x2={width - padX}
            y2={padY}
            stroke="#1a1a1a"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={padY + chartH / 2}
            x2={width - padX}
            y2={padY + chartH / 2}
            stroke="#1a1a1a"
            strokeDasharray="4 4"
          />
          <line
            x1={padX}
            y1={height - padY}
            x2={width - padX}
            y2={height - padY}
            stroke="#222222"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#violetGradient)" />

          {/* Violet curve */}
          <path d={pathD} fill="none" stroke="#8052ff" strokeWidth="2.5" />

          {/* Data points */}
          {coords.map((c, i) => {
            const isHovered = hoveredIdx === i;
            const isHighlight = points[i].highlight;

            return (
              <g key={i}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 6 : isHighlight ? 4.5 : 3.5}
                  fill={isHighlight ? '#ffb829' : '#8052ff'}
                  stroke="#000000"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {/* X-axis labels */}
                <text
                  x={c.x}
                  y={height - 8}
                  fill="#9a9a9a"
                  fontSize="11"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {points[i].date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover / Tooltip Display */}
        {hoveredIdx !== null && (
          <div
            className="absolute top-6 left-6 bg-[#0e0e0e] border border-[#2a2a2a] p-2.5 rounded-xl text-xs font-mono tabular-nums shadow-lg pointer-events-none"
          >
            <p className="text-[#9a9a9a] text-[10px]">{points[hoveredIdx].date}</p>
            <p className="text-white font-medium text-sm">
              {points[hoveredIdx].count} complaints
            </p>
            {points[hoveredIdx].highlight && (
              <p className="text-[#ffb829] text-[10px] mt-0.5">
                Cluster volume spike flagged
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
