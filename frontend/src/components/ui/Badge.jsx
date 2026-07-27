import React, { memo } from 'react';

const VARIANT_STYLES = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
  danger:  'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border border-red-200 dark:border-red-500/20',
  info:    'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
  default: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border border-gray-200 dark:border-slate-700',
};

const DOT_COLORS = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  default: 'bg-gray-400',
};

const SIZE_STYLES = {
  sm: 'px-2 py-0 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

/**
 * Badge
 * Props:
 *  variant   'success'|'warning'|'danger'|'info'|'default'
 *  size      'sm'|'md'
 *  dot       boolean — renders a colored dot before text
 *  className string
 */
const Badge = memo(({ children, variant = 'default', size = 'md', dot = false, className = '' }) => (
  <span
    className={`inline-flex items-center font-medium rounded-full ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
  >
    {dot && (
      <span
        className={`badge-dot ${DOT_COLORS[variant]}`}
        aria-hidden="true"
      />
    )}
    {children}
  </span>
));

Badge.displayName = 'Badge';

export default Badge;
