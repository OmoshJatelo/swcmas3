import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendLabel, className = '' }) => {
  const isPositive = trend > 0;
  const isNegative = trend < 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  const trendColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
    : isNegative
    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
    : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800';

  return (
    <div
      className={`
        glass-panel rounded-2xl overflow-hidden
        hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300
        ${className}
      `}
    >
      {/* Accent top bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-brand-500 via-emerald-400 to-transparent" />

      <div className="p-6">
        {/* Top row: label + icon */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              {title}
            </p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">
              {value}
            </h3>
          </div>

          {Icon && (
            <div className="ml-4 p-3 rounded-xl bg-gradient-to-br from-brand-500/15 to-emerald-400/10 dark:from-brand-500/20 dark:to-emerald-400/10 ring-1 ring-brand-500/20 dark:ring-brand-400/20 shrink-0">
              <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
          )}
        </div>

        {/* Divider + trend row */}
        {(trend !== undefined || trendLabel) && (
          <>
            <div className="mt-4 mb-3 border-t border-gray-100 dark:border-slate-700/50" />
            <div className="flex items-center gap-2 text-sm">
              {trend !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${trendColor}`}
                >
                  <TrendIcon className="w-3 h-3" />
                  {Math.abs(trend)}%
                </span>
              )}
              {trendLabel && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {trendLabel}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatCard;
