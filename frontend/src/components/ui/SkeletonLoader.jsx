import React from 'react';

/** Single shimmer bar */
export const SkeletonBar = ({ className = 'h-4 w-full' }) => (
  <div className={`skeleton ${className}`} />
);

/** Skeleton for the upgraded KPI StatCard (matching new taller card) */
export const SkeletonStatCard = () => (
  <div className="glass-panel p-5 rounded-2xl space-y-4 overflow-hidden">
    <div className="flex items-start justify-between">
      <SkeletonBar className="h-3 w-28 mt-1" />
      <SkeletonBar className="w-10 h-10 rounded-xl" />
    </div>
    <SkeletonBar className="h-9 w-24" />
    <div className="flex items-center gap-2">
      <SkeletonBar className="h-5 w-14 rounded-full" />
      <SkeletonBar className="h-3 w-20" />
    </div>
  </div>
);

/** Skeleton for a chart card */
export const SkeletonChartCard = ({ className = '' }) => (
  <div className={`glass-panel p-5 rounded-2xl space-y-4 overflow-hidden ${className}`}>
    <SkeletonBar className="h-4 w-40" />
    <SkeletonBar className="h-3 w-24" />
    <SkeletonBar className="h-56 w-full rounded-xl mt-2" />
  </div>
);

/** Skeleton for a progress score card (TrustScoreGauge replacement) */
export const SkeletonProgressCard = () => (
  <div className="glass-panel p-5 rounded-2xl space-y-3 overflow-hidden">
    <div className="flex items-center justify-between">
      <SkeletonBar className="h-3 w-32" />
      <SkeletonBar className="h-5 w-16 rounded-full" />
    </div>
    <SkeletonBar className="h-9 w-20 mt-1" />
    <SkeletonBar className="h-2 w-full rounded-full" />
  </div>
);

/** A single shimmer table row */
const SkeletonTableRow = ({ cols = 5 }) => (
  <tr className="border-b border-gray-100 dark:border-slate-800/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3.5 px-4">
        <SkeletonBar className={`h-3.5 ${i === 0 ? 'w-36' : 'w-20'}`} />
      </td>
    ))}
  </tr>
);

/** n shimmer rows for use inside a DataTable tbody */
const SkeletonRows = ({ count = 5, cols = 5 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonTableRow key={i} cols={cols} />
    ))}
  </>
);

export default SkeletonRows;
