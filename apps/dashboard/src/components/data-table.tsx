'use client';

import type { ReactNode } from 'react';
import { LoadingState } from './loading-state';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyContent?: ReactNode;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  getRowKey: (row: T, index: number) => string;
  caption?: string;
  ariaLabel?: string;
}

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  emptyContent,
  sortKey,
  sortDirection,
  onSort,
  getRowKey,
  caption,
  ariaLabel,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-100" aria-hidden="true" />
        </div>
        <LoadingState label="Loading records" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {caption && <p className="sr-only">{caption}</p>}
        <div className="px-4 py-2">
          {emptyContent ?? (
            <p className="py-12 text-center text-sm text-slate-400">No records found.</p>
          )}
        </div>
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

                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left';

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
                          {isSorted
                            ? sortDirection === 'asc'
                              ? '▲'
                              : sortDirection === 'desc'
                                ? '▼'
                                : '↕'
                            : '↕'}
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
              <tr
                key={getRowKey(row, idx)}
                className="transition-colors hover:bg-slate-50/60 motion-reduce:transition-none"
              >
                {columns.map((col) => {
                  const alignClass =
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3 align-middle ${alignClass} ${col.className ?? ''}`}
                    >
                      {col.render ? (
                        col.render(row)
                      ) : col.accessor ? (
                        <span className="tabular-nums">{String(col.accessor(row) ?? '—')}</span>
                      ) : null}
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
