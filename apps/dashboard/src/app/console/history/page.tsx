'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@fleek/ui';
import { PRODUCT_LABELS, type VerificationType } from '@fleek/types';
import { apiFetch, useAuth } from '@/lib/auth';
import {
  buildHistoryQuery,
  buildVerificationsExportUrl,
  buildCertificateUrl,
  classifyHistoryStatus,
  getHistoryStatusLabel,
  summarizeHistoryMetrics,
  downloadReport,
  type HistoryFilters,
} from '@/lib/exports';
import { FilterBar } from '@/components/filter-bar';
import { DataTable, type DataTableColumn, type SortDirection } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { DashboardIcon } from '@/components/dashboard-icons';

interface HistoryItem {
  id: string;
  type: VerificationType;
  status: string;
  source: string;
  cost: number;
  latencyMs: number | null;
  createdAt: string;
  subject: string;
  isBackup?: boolean;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type SortKey = 'subject' | 'type' | 'status' | 'cost' | 'createdAt' | 'latencyMs';
type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const DEFAULT_LIMIT = 20;
const LIMIT_OPTIONS = [10, 20, 50, 100];

function formatCost(kes: number): string {
  if (!Number.isFinite(kes) || kes === 0) return '—';
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kes)}`;
}

function formatLatency(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${ms}ms`;
}

export default function HistoryPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({ limit: DEFAULT_LIMIT, offset: 0 });
  const [sortKey, setSortKey] = useState<SortKey | null>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const debouncedSearch = useDebouncedValue(filters.search ?? '', 300);
  const debouncedFilters = useMemo<HistoryFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const abortRef = useRef<AbortController | null>(null);

  // Fetch with typed query params (server-side search)
  const load = useCallback(async () => {
    if (!token) return;
    // Cancel in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const qs = buildHistoryQuery(debouncedFilters);
      const path = qs ? `/verifications?${qs}` : '/verifications';
      const res = await apiFetch<{ total: number; items: HistoryItem[] }>(path, {
        token,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Sanitize: avoid leaking raw upstream messages; show generic retryable error
      const isAbort = err instanceof Error && err.message.toLowerCase().includes('abort');
      if (isAbort) return;
      setError('Failed to load history. Please retry.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token, debouncedFilters]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  function handleFilterChange(next: HistoryFilters) {
    // Reset offset when filters change (except pagination itself)
    setFilters({ ...next, offset: 0 });
  }

  function handleReset() {
    setFilters({ limit: filters.limit ?? DEFAULT_LIMIT, offset: 0 });
  }

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((prev) => {
        const next = prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc';
        if (next === null) setSortKey(null);
        return next;
      });
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortDir) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortKey) {
        case 'subject':
          va = a.subject.toLowerCase();
          vb = b.subject.toLowerCase();
          break;
        case 'type':
          va = a.type;
          vb = b.type;
          break;
        case 'status':
          va = a.status;
          vb = b.status;
          break;
        case 'cost':
          va = a.cost;
          vb = b.cost;
          break;
        case 'latencyMs':
          va = a.latencyMs ?? -1;
          vb = b.latencyMs ?? -1;
          break;
        case 'createdAt':
          va = new Date(a.createdAt).getTime();
          vb = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const metrics = useMemo(() => summarizeHistoryMetrics(sortedItems), [sortedItems]);

  const limit = filters.limit ?? DEFAULT_LIMIT;
  const offset = filters.offset ?? 0;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + sortedItems.length, total);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    setExportError(null);
    try {
      const url = buildVerificationsExportUrl(debouncedFilters, format);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `fleek-verifications-${stamp}.${format}`;
      await downloadReport(url, filename, token);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  async function handleCertificate(id: string) {
    setExportError(null);
    try {
      const url = buildCertificateUrl(id);
      await downloadReport(url, `certificate-${id.slice(0, 8)}.pdf`, token);
    } catch {
      setExportError('Certificate download failed. Please try again.');
    }
  }

  const columns: DataTableColumn<HistoryItem>[] = useMemo<DataTableColumn<HistoryItem>[]>(
    () => [
      {
        key: 'subject',
        header: 'Subject',
        sortable: true,
        className: 'max-w-[180px]',
        render: (row) => (
          <span className="inline-block max-w-[180px] break-all font-mono text-xs tabular-nums" title={row.subject}>
            {row.subject}
          </span>
        ),
      },
      {
        key: 'type',
        header: 'Product',
        sortable: true,
        render: (row) => (
          <span className="whitespace-nowrap text-xs font-medium text-navy-900">
            {PRODUCT_LABELS[row.type as keyof typeof PRODUCT_LABELS] ?? String(row.type).replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => (
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge tone={classifyHistoryStatus(row.status)} label={getHistoryStatusLabel(row.status)} />
            {row.isBackup && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/15">
                backup
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        render: (row) => <span className="text-xs capitalize text-slate-500">{row.source}</span>,
      },
      {
        key: 'cost',
        header: 'Cost',
        sortable: true,
        align: 'right',
        className: 'tabular-nums',
        render: (row) => <span className="whitespace-nowrap tabular-nums text-navy-900">{formatCost(row.cost)}</span>,
      },
      {
        key: 'latencyMs',
        header: 'Latency',
        sortable: true,
        align: 'right',
        className: 'tabular-nums',
        render: (row) => <span className="whitespace-nowrap tabular-nums text-slate-500">{formatLatency(row.latencyMs)}</span>,
      },
      {
        key: 'createdAt',
        header: 'When',
        sortable: true,
        align: 'right',
        className: 'tabular-nums',
        render: (row) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-slate-500" title={row.createdAt}>
            {new Date(row.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (row) => (
          <span className="inline-flex items-center gap-1">
            <Link
              href={`/console/history/${row.id}`}
              aria-label={`View details for ${row.subject}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              View
            </Link>
            <button
              type="button"
              onClick={() => void handleCertificate(row.id)}
              aria-label={`Download certificate for ${row.subject}`}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              title="Download certificate PDF"
            >
              <DashboardIcon name="download" className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Certificate</span>
            </button>
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Reporting</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 md:text-3xl">Verification history</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Filter, sort, and export every check. Certificates are available per record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exporting !== null}
            aria-label="Export verifications as CSV"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
          >
            <DashboardIcon name="download" className="h-4 w-4" aria-hidden="true" />
            {exporting === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('xlsx')}
            disabled={exporting !== null}
            aria-label="Export verifications as Excel"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
          >
            <DashboardIcon name="file" className="h-4 w-4" aria-hidden="true" />
            {exporting === 'xlsx' ? 'Exporting…' : 'XLSX'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exporting !== null}
            aria-label="Export verifications as PDF"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
          >
            <DashboardIcon name="download" className="h-4 w-4" aria-hidden="true" />
            {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Summary metrics */}
      <section aria-label="History summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total cost (visible)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy-900">KES {metrics.totalCost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-slate-400">{metrics.total} records in view</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Average latency</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy-900">{metrics.avgLatencyMs != null ? `${metrics.avgLatencyMs}ms` : '—'}</p>
          <p className="mt-1 text-xs text-slate-400">Across visible records</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status distribution</p>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-live="polite">
            {Object.keys(metrics.statusCounts).length === 0 ? (
              <span className="text-xs text-slate-400">No data</span>
            ) : (
              Object.entries(metrics.statusCounts).map(([s, count]) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200">
                  <StatusBadge tone={classifyHistoryStatus(s)} label={getHistoryStatusLabel(s)} className="scale-90" />
                  <span className="tabular-nums">{count}</span>
                </span>
              ))
            )}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total records</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy-900">{total.toLocaleString('en-KE')}</p>
          <p className="mt-1 text-xs text-slate-400">
            Showing {rangeStart}–{rangeEnd}
          </p>
        </Card>
      </section>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} onReset={handleReset} />

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4" role="alert" aria-live="assertive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {exportError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert" aria-live="assertive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-800">{exportError}</p>
            <button
              type="button"
              onClick={() => setExportError(null)}
              aria-label="Dismiss export error"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <LoadingState label="Loading verification history" />
      ) : (
        <DataTable<HistoryItem>
          columns={columns}
          rows={sortedItems}
          loading={false}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
          getRowKey={(row) => row.id}
          ariaLabel="Verification history"
          caption="Verification history with sortable columns"
          emptyContent={
            <EmptyState
              title="No verifications match your filters"
              description="Adjust the filters above or run a new verification to populate history."
              action={{ label: 'Run a verification', href: '/console/verify' }}
            />
          }
        />
      )}

      {/* Pagination + limit controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
            Showing <span className="font-semibold text-navy-900">{rangeStart}</span>–<span className="font-semibold text-navy-900">{rangeEnd}</span> of{' '}
            <span className="font-semibold text-navy-900">{total.toLocaleString('en-KE')}</span> records
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="history-limit" className="text-xs font-medium text-slate-600">
              Rows per page
            </label>
            <select
              id="history-limit"
              value={String(limit)}
              onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value), offset: 0 }))}
              aria-label="Select number of rows per page"
              className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(0, (prev.offset ?? 0) - limit) }))}
                disabled={offset === 0 || loading}
                aria-label="Previous page"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, offset: (prev.offset ?? 0) + limit }))}
                disabled={offset + limit >= total || loading}
                aria-label="Next page"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
