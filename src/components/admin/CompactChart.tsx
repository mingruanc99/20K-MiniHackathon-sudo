// src/components/admin/CompactChart.tsx
import React,{ useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface CompactChartProps {
  data: DataPoint[];
  color?: string;
  fillColor?: string;
  height?: number;
  type?: 'area' | 'bar' | 'line';
  valuePrefix?: string;
  valueSuffix?: string;
}

export const CompactChart: React.FC<CompactChartProps> = ({
  data,
  color = '#2c5a47',
  fillColor = 'rgba(44, 90, 71, 0.10)',
  height = 160,
  type = 'area',
  valuePrefix = '',
  valueSuffix = ''
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-ink-faint">Không có dữ liệu</div>;
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const paddingX = 20;
  const paddingY = 24;
  const width = 500;
  const chartHeight = height;

  const getX = (index: number) => {
    return paddingX + (index / (data.length - 1 || 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return chartHeight - paddingY - ((val - minVal) / range) * (chartHeight - paddingY * 2);
  };

  // Build SVG path
  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`);
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${getX(data.length - 1)},${chartHeight - paddingY} L ${getX(0)},${chartHeight - paddingY} Z`;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {hoveredIdx !== null && (
        <div
          className="absolute z-20 pointer-events-none px-2.5 py-1 bg-cover text-white rounded text-xs font-mono shadow-md transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(getX(hoveredIdx) / width) * 100}%`,
            top: `${getY(data[hoveredIdx].value) - 8}px`
          }}
        >
          <div className="text-[11px] text-paper/80 font-sans">{data[hoveredIdx].label}</div>
          <div className="font-semibold text-cover-foil">
            {valuePrefix}{data[hoveredIdx].value.toLocaleString()}{valueSuffix}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        {/* Subtle grid lines */}
        <line
          x1={paddingX}
          y1={paddingY}
          x2={width - paddingX}
          y2={paddingY}
          stroke="#f1f5f9"
          strokeDasharray="3 3"
        />
        <line
          x1={paddingX}
          y1={chartHeight / 2}
          x2={width - paddingX}
          y2={chartHeight / 2}
          stroke="#f1f5f9"
          strokeDasharray="3 3"
        />
        <line
          x1={paddingX}
          y1={chartHeight - paddingY}
          x2={width - paddingX}
          y2={chartHeight - paddingY}
          stroke="#e2e8f0"
        />

        {/* Area fill */}
        {type === 'area' && (
          <path d={areaD} fill={fillColor} />
        )}

        {/* Line */}
        {(type === 'line' || type === 'area') && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Bar type */}
        {type === 'bar' && (
          data.map((d, i) => {
            const barW = Math.max(6, (width - paddingX * 2) / data.length - 8);
            const x = getX(i) - barW / 2;
            const y = getY(d.value);
            const h = chartHeight - paddingY - y;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx="3"
                fill={hoveredIdx === i ? color : fillColor}
                stroke={color}
                strokeWidth="1"
                className="transition-colors cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })
        )}

        {/* Interactive hover points */}
        {type !== 'bar' &&
          data.map((d, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(d.value)}
              r={hoveredIdx === i ? 5 : 3}
              fill={hoveredIdx === i ? color : '#ffffff'}
              stroke={color}
              strokeWidth="2"
              className="transition-all cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between text-[11px] text-ink-faint pt-1 font-mono px-2">
        <span>{data[0]?.label}</span>
        {data.length > 4 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};
