import React, { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

/* ─────────────────────────────────────────────────────────
   Shared dark tooltip (same pattern as LineChartCard)
───────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="text-slate-400 text-xs mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.fill }} />
          <span className="text-slate-300 capitalize">{entry.dataKey}:</span>
          <span className="text-white font-semibold tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const ChartLegend = ({ payload }) => (
  <div className="flex items-center gap-4 justify-end mt-2">
    {payload?.map((entry) => (
      <div key={entry.value} className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: entry.fill || entry.color }} />
        <span className="text-xs text-gray-500 dark:text-slate-400 capitalize">{entry.value}</span>
      </div>
    ))}
  </div>
);

/**
 * BarChartCard
 * Props:
 *  title     string
 *  subtitle  string (optional)
 *  data      array
 *  dataKey   string
 *  xAxisKey  string
 *  colors    string[] (optional — per-bar color override)
 *  className string
 */
const BarChartCard = memo(({ title, subtitle, data, dataKey, xAxisKey, colors, className = '' }) => {
  const defaultColors = ['#10b981', '#059669', '#34d399', '#6ee7b7'];

  return (
    <div className={`glass-panel p-5 rounded-2xl ${className}`}>
      <div className="mb-5">
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
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
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
            <Legend content={<ChartLegend />} />
            <Bar dataKey={dataKey} radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={700} animationEasing="ease-out">
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={(colors || defaultColors)[index % (colors || defaultColors).length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

BarChartCard.displayName = 'BarChartCard';

export default BarChartCard;
