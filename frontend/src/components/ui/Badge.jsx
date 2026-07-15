import React from 'react';

const variantConfig = {
  success: {
    wrapper: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  warning: {
    wrapper: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/25',
    dot: 'bg-amber-500',
  },
  danger: {
    wrapper: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/25',
    dot: 'bg-red-500',
  },
  info: {
    wrapper: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/25',
    dot: 'bg-blue-500',
  },
  default: {
    wrapper: 'bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-slate-700',
    dot: 'bg-gray-400 dark:bg-gray-500',
  },
};

const Badge = ({ children, variant = 'default', dot = true, className = '' }) => {
  const config = variantConfig[variant] || variantConfig.default;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5
        rounded-full text-xs font-semibold tracking-wide
        backdrop-blur-sm transition-all duration-200
        ${config.wrapper} ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;
