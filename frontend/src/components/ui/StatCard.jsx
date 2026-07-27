import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Accent color variants — controls the icon background and
   accent pill color. Defaults to brand (green).
───────────────────────────────────────────────────────── */
const VARIANT_STYLES = {
  brand:  { icon: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400', accent: 'bg-brand-500' },
  green:  { icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
  blue:   { icon: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', accent: 'bg-blue-500' },
  amber:  { icon: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', accent: 'bg-amber-500' },
  red:    { icon: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400', accent: 'bg-red-500' },
  purple: { icon: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400', accent: 'bg-purple-500' },
};

const TREND_STYLES = {
  positive: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
  negative: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
  neutral:  'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800',
};

/**
 * KpiCard — enterprise-grade KPI metric card.
 *
 * Props:
 *  title       string  — metric label
 *  value       any     — primary metric value
 *  icon        LucideIcon
 *  variant     'brand'|'green'|'blue'|'amber'|'red'|'purple'
 *  trend       number  — percent change (positive/negative)
 *  trendLabel  string  — e.g. "vs last week"
 *  subtitle    string  — secondary context line
 *  className   string
 */
const StatCard = memo(({ title, value, icon: Icon, variant = 'brand', trend, trendLabel, subtitle, className = '' }) => {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.brand;

  const trendDir = trend > 0 ? 'positive' : trend < 0 ? 'negative' : 'neutral';
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <div
      className={`glass-panel p-5 rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1 group animate-scale-in ${className}`}
    >
      {/* Top row: icon + label */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-snug">{title}</p>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${styles.icon} transition-transform duration-200 group-hover:scale-110`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Main metric */}
      <p className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">
        {value ?? '—'}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}

      {/* Trend indicator */}
      {(trend !== undefined || trendLabel) && (
        <div className="mt-4 flex items-center gap-2">
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${TREND_STYLES[trendDir]}`}>
              <TrendIcon className="w-3 h-3" aria-hidden="true" />
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;
