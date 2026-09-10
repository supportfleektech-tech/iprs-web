'use client';

import type { ReactNode } from 'react';
import { LoadingState } from './loading-state';

export type AdminTableSortDirection = 'asc' | 'desc' | null;

export interface AdminTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
}

export interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyContent?: ReactNode;
  sortKey?: string | null;
  sortDirection?: AdminTableSortDirection;
  onSort?: (key: string) => void;
  getRowKey: (row: T, index: number) => string;
  caption?: string;
  ariaLabel?: string;
}

/**
 * AdminTable — dense data table for the command center.
 * Mirrors DataTable semantics but with admin-specific empty/error states,
 * 44px sort targets, sticky-header-ready structure, reduced-motion.
 */
export function AdminTable<T>({
  columns,
  rows,
  loading = false,
  error,
  onRetry,
  emptyContent,
  sortKey,
  sortDirection,
  onSort,
  getRowKey,
  caption,
  ariaLabel,
}: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <LoadingState label="Loading records" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-red-200 bg-white" role="alert" aria-live="assertive">
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <p className="mt-1 text-xs text-slate-500">The request did not complete. Retry to reload this table.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-navy-900 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none"
              aria-label="Retry loading table"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {caption && <p className="sr-only">{caption}</p>}
        <div className="px-4 py-2">{emptyContent ?? <p className="py-12 text-center text-sm text-slate-400">No records found.</p>}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={ariaLabel}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const ariaSort: 'ascending' | 'descending' | 'none' | undefined = col.sortable
                  ? isSorted
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : sortDirection === 'desc'
                        ? 'descending'
                        : 'none'
                    : 'none'
                  : undefined;
                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`whitespace-nowrap px-4 py-3 font-semibold ${alignClass} ${col.headerClassName ?? ''}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        aria-label={`Sort by ${col.header}${isSorted ? `, currently ${sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'not sorted'}` : ''}`}
                        className="inline-flex h-11 items-center gap-1 rounded-lg px-2 -mx-2 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-slate-100 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none"
                      >
                        <span>{col.header}</span>
                        <span aria-hidden="true" className="text-[10px] leading-none">
                          {isSorted ? (sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '↕') : '↕'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={getRowKey(row, idx)} className="transition-colors hover:bg-slate-50/60 motion-reduce:transition-none">
                {columns.map((col) => {
                  const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                  return (
                    <td key={col.key} className={`px-4 py-3 align-middle ${alignClass} ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : col.accessor ? <span className="tabular-nums">{String(col.accessor(row) ?? '—')}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
