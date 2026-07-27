import React, { memo } from 'react';
import SkeletonRows from './SkeletonLoader.jsx';
import EmptyState from './EmptyState.jsx';
import { FileSearch } from 'lucide-react';

/**
 * DataTable — enterprise-grade data table with zebra rows, sticky header support, loading state.
 *
 * Props:
 *  columns       { header, accessor, render? }[]
 *  data          array
 *  keyField      string (default 'id')
 *  onRowClick    fn(row)
 *  emptyMessage  string
 *  isLoading     boolean
 *  stickyHeader  boolean
 *  aria-label    string
 */
const DataTable = memo(({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  stickyHeader = false,
  'aria-label': ariaLabel,
}) => (
  <div className="overflow-x-auto -mx-1">
    <table className="w-full text-left border-collapse" role="table" aria-label={ariaLabel}>
      <thead>
        <tr className={`border-b border-gray-200 dark:border-slate-700/70 ${stickyHeader ? 'sticky top-0 z-10 bg-white dark:bg-slate-900' : ''}`}>
          {columns.map((col, i) => (
            <th
              key={i}
              scope="col"
              className="pb-3 px-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="text-sm divide-y divide-gray-100 dark:divide-slate-800/80">
        {isLoading ? (
          <SkeletonRows count={5} cols={columns.length} />
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-10">
              <EmptyState
                icon={FileSearch}
                title="No results"
                message={emptyMessage}
              />
            </td>
          </tr>
        ) : (
          data.map((row, rowIndex) => (
            <tr
              key={row[keyField] ?? rowIndex}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row); } : undefined}
              className={`transition-colors duration-100 ${
                onRowClick ? 'cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-500/5 focus-ring' : ''
              } ${rowIndex % 2 === 1 ? 'bg-gray-50/50 dark:bg-slate-800/20' : ''}`}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="py-3.5 px-4 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
));

DataTable.displayName = 'DataTable';

export default DataTable;
