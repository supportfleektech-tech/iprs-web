'use client';

import type { BadgeTone } from '@fleek/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface HistoryFilters {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SummaryMetrics {
  totalCost: number;
  avgLatencyMs: number | null;
  statusCounts: Record<string, number>;
  total: number;
}

// ---------------------------------------------------------------------------
// Query helpers — typed, omit empty
// ---------------------------------------------------------------------------
export function buildHistoryQuery(filters: HistoryFilters): string {
  const params = new URLSearchParams();
  const type = filters.type?.trim();
  if (type) params.set('type', type);

  const status = filters.status?.trim();
  if (status) params.set('status', status);

  // Support both from/to and startDate/endDate aliases
  const from = (filters.from ?? filters.startDate)?.trim();
  if (from) params.set('from', from);

  const to = (filters.to ?? filters.endDate)?.trim();
  if (to) params.set('to', to);

  const search = filters.search?.trim();
  if (search) params.set('search', search);

  if (filters.limit != null && Number.isFinite(filters.limit)) params.set('limit', String(filters.limit));
  if (filters.offset != null && Number.isFinite(filters.offset)) params.set('offset', String(filters.offset));

  return params.toString();
}

export function buildHistoryQueryString(filters: HistoryFilters): string {
  const qs = buildHistoryQuery(filters);
  return qs ? `?${qs}` : '';
}

// Export URLs — reuse existing /exports/* contract
export function buildVerificationsExportUrl(filters: HistoryFilters, format: ExportFormat): string {
  const params = new URLSearchParams();
  params.set('format', format);
  const type = filters.type?.trim();
  if (type) params.set('type', type);
  const status = filters.status?.trim();
  if (status) params.set('status', status);
  const from = (filters.from ?? filters.startDate)?.trim();
  if (from) params.set('from', from);
  const to = (filters.to ?? filters.endDate)?.trim();
  if (to) params.set('to', to);
  const search = filters.search?.trim();
  if (search) params.set('search', search);
  return `/exports/verifications?${params.toString()}`;
}

export function buildCertificateUrl(id: string): string {
  return `/exports/verifications/${encodeURIComponent(id)}/certificate`;
}

export function buildBatchExportUrl(batchId: string, format: ExportFormat): string {
  return `/exports/verifications/batch/${encodeURIComponent(batchId)}?format=${format}`;
}

export function buildWalletStatementUrl(filters: Pick<HistoryFilters, 'from' | 'to' | 'startDate' | 'endDate'>, format: ExportFormat): string {
  const params = new URLSearchParams();
  params.set('format', format);
  const from = (filters.from ?? filters.startDate)?.trim();
  if (from) params.set('from', from);
  const to = (filters.to ?? filters.endDate)?.trim();
  if (to) params.set('to', to);
  return `/exports/wallet/statement?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSV escaping
// ---------------------------------------------------------------------------
export function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = escapeCsvCell;
  const lines = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Status classification — history-specific (success green, pending amber,
// not_found amber, failed red, else slate)
// ---------------------------------------------------------------------------
export function classifyHistoryStatus(status: string): BadgeTone {
  const s = (status ?? '').toLowerCase().trim();
  if (s === 'success' || s === 'completed' || s === 'paid' || s === 'approved' || s === 'valid' || s === 'clear') return 'green';
  if (s === 'failed' || s === 'rejected' || s === 'error' || s === 'expired' || s === 'invalid' || s === 'disabled') return 'red';
  if (s === 'not_found' || s === 'pending' || s === 'processing' || s === 'attention' || s === 'medium') return 'amber';
  if (s === 'low' || s === 'info' || s === 'informational') return 'blue';
  if (s === 'green' || s === 'red' || s === 'amber' || s === 'blue' || s === 'slate') return s as BadgeTone;
  return 'slate';
}

export function getHistoryStatusLabel(status: string): string {
  const s = (status ?? '').toLowerCase().trim();
  if (s === 'success') return 'Success';
  if (s === 'failed') return 'Failed';
  if (s === 'not_found') return 'Not found';
  if (s === 'pending') return 'Pending';
  if (s === 'processing') return 'Processing';
  return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'Unknown';
}

// ---------------------------------------------------------------------------
// Summary metrics from returned records
// ---------------------------------------------------------------------------
export function summarizeHistoryMetrics(
  items: Array<{ cost: number; latencyMs: number | null; status: string }>,
): SummaryMetrics {
  const total = items.length;
  const totalCost = items.reduce((sum, it) => sum + (Number.isFinite(it.cost) ? it.cost : 0), 0);
  const latencies = items.map((it) => it.latencyMs).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const statusCounts: Record<string, number> = {};
  for (const it of items) {
    const k = (it.status ?? '').toLowerCase();
    statusCounts[k] = (statusCounts[k] ?? 0) + 1;
  }
  return { totalCost, avgLatencyMs, statusCounts, total };
}

// ---------------------------------------------------------------------------
// Download helper — accepts an existing /exports/* URL and filename
// ---------------------------------------------------------------------------
export async function downloadReport(url: string, filename: string, token?: string | null): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
  // Resolve token from explicit param or localStorage session fallback
  let authToken = token ?? null;
  if (!authToken && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('fleek_session');
      if (raw) {
        const parsed = JSON.parse(raw) as { accessToken?: string };
        authToken = parsed.accessToken ?? null;
      }
    } catch {
      // ignore
    }
  }

  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  const res = await fetch(fullUrl, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  // Append to body for Firefox compatibility
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
