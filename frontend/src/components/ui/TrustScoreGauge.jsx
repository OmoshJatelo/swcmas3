import React, { memo } from 'react';

/**
 * ProgressScoreCard — replaces TrustScoreGauge.
 * Cleaner, more readable animated linear progress bar.
 * Backward-compatible: can still be called as <TrustScoreGauge score={n} title="..." />
 *
 * Props:
 *  score     number  0–100
 *  title     string
 *  className string
 */
const TrustScoreGauge = memo(({ score, title = 'Trust Score', className = '' }) => {
  const pct = Math.min(100, Math.max(0, Math.round(score || 0)));

  // Color thresholds
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-amber-500' :
    'bg-red-500';

  const textColor =
    pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
    pct >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  const label =
    pct >= 80 ? 'Excellent' :
    pct >= 50 ? 'Needs Attention' :
    'Critical';

  return (
    <div className={`glass-panel p-5 rounded-2xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          pct >= 80 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
          pct >= 50 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' :
          'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
        }`}>
          {label}
        </span>
      </div>

      {/* Big metric */}
      <p className={`text-4xl font-extrabold tracking-tight tabular-nums mb-4 ${textColor}`}>
        {pct}<span className="text-xl font-medium text-gray-400 dark:text-slate-500">%</span>
      </p>

      {/* Progress bar */}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title}: ${pct}%`}
      >
        <div
          className={`progress-fill ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-400 dark:text-slate-600">0%</span>
        <span className="text-[10px] text-gray-400 dark:text-slate-600">100%</span>
      </div>
    </div>
  );
});

TrustScoreGauge.displayName = 'TrustScoreGauge';

export default TrustScoreGauge;
