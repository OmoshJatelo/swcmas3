import React from 'react';

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
  lg: 'w-4 h-4',
};

const gapSizes = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2',
};

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const dot = dotSizes[size] || dotSizes.md;
  const gap = gapSizes[size] || gapSizes.md;

  return (
    <div className={`flex justify-center items-center ${gap} ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${dot} rounded-full bg-brand-500 dark:bg-brand-400 opacity-0 animate-pulse`}
          style={{
            animationDuration: '1.2s',
            animationDelay: `${i * 0.2}s`,
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
            animationIterationCount: 'infinite',
          }}
        />
      ))}
    </div>
  );
};

export default LoadingSpinner;
