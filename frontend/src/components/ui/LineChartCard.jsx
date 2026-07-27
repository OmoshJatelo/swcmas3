import React, { memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

/* ─────────────────────────────────────────────────────────
   Custom Tooltip
───────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-slate-400 text-xs mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.stroke }} />
          <span className="text-slate-300 capitalize">{entry.dataKey}:</span>
          <span className="text-white font-semibold tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   Custom Legend
───────────────────────────────────────────────────────── */
const ChartLegend = ({ payload }) => (
  <div className="flex items-center gap-4 justify-end mt-2">
    {payload?.map((entry) => (
      <div key={entry.value} className="flex items-center gap-1.5">
        <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: entry.color }} />
        <span className="text-xs text-gray-500 dark:text-slate-400 capitalize">{entry.value}</span>
      </div>
    ))}
  </div>
);

/**
 * LineChartCard
 * Props:
 *  title     string
 *  subtitle  string  (optional)
 *  data      array
 *  lines     [{ dataKey, stroke, label? }]
 *  xAxisKey  string
 *  className string
 */
const LineChartCard = memo(({ title, subtitle, data, lines, xAxisKey, className = '' }) => (
  <div className={`glass-panel p-5 rounded-2xl ${className}`}>
    {/* Header */}
    <div className="mb-5">
      <h3 className="section-title">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>

    {/* Chart */}
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-800" opacity={1} />
          <XAxis
            dataKey={xAxisKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Legend content={<ChartLegend />} />
          {lines.map((line, i) => (
            <Line
              key={`${line.dataKey}-${i}`}
              type="monotone"
              dataKey={line.dataKey}
              name={line.label || line.dataKey}
              stroke={line.stroke || '#10b981'}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: line.stroke || '#10b981' }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
));

LineChartCard.displayName = 'LineChartCard';

export default LineChartCard;
