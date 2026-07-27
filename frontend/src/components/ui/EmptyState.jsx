import React from 'react';

const EmptyState = ({ icon: Icon, title, message, action, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">{message}</p>
      <div className="flex flex-col items-center gap-3">
        {action && <div>{action}</div>}
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 border border-brand-300 dark:border-brand-600 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 focus-ring transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
