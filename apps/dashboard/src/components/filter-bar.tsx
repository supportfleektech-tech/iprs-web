'use client';

import type { HistoryFilters } from '@/lib/exports';
import { VerificationType, PRODUCT_LABELS } from '@fleek/types';

export interface FilterBarProps {
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_found', label: 'Not found' },
  { value: 'failed', label: 'Failed' },
];

// Keep select to manageable subset but allow all 24; show placeholder for brevity
const PRODUCT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All products' },
  ...Object.values(VerificationType).map((v) => ({ value: v, label: PRODUCT_LABELS[v] })),
];

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  function update(patch: Partial<HistoryFilters>) {
    onChange({ ...filters, ...patch });
  }

  const hasActive =
    Boolean(filters.type?.trim() || filters.status?.trim() || filters.from?.trim() || filters.to?.trim() || filters.search?.trim());

  return (
    <section
      aria-label="History filters"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Filters</h2>
        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Search */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-search" className="text-xs font-medium text-slate-600">
            Search
          </label>
          <input
            id="history-search"
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Subject, ID, or reference"
            aria-label="Search verifications by subject"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        {/* Product */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-product" className="text-xs font-medium text-slate-600">
            Product
          </label>
          <select
            id="history-product"
            value={filters.type ?? ''}
            onChange={(e) => update({ type: e.target.value })}
            aria-label="Filter by product"
            className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            {PRODUCT_OPTIONS.map((opt) => (
              <option key={opt.value || '__all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-status" className="text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="history-status"
            value={filters.status ?? ''}
            onChange={(e) => update({ status: e.target.value })}
            aria-label="Filter by status"
            className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || '__all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-from" className="text-xs font-medium text-slate-600">
            From date
          </label>
          <input
            id="history-from"
            type="date"
            value={filters.from ?? filters.startDate ?? ''}
            onChange={(e) => update({ from: e.target.value, startDate: undefined })}
            aria-label="Filter from date"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="history-to" className="text-xs font-medium text-slate-600">
            To date
          </label>
          <input
            id="history-to"
            type="date"
            value={filters.to ?? filters.endDate ?? ''}
            onChange={(e) => update({ to: e.target.value, endDate: undefined })}
            aria-label="Filter to date"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
      </div>
    </section>
  );
}
