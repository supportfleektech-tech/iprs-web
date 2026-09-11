import type { BadgeTone } from '@fleek/ui';

// --- Data shapes ---

export interface OverviewStats {
  organizations: number;
  verifications: number;
  pendingTopUps: number;
}

export interface OverviewVerification {
  id: string;
  type: string;
  status: string;
  source: string;
  cost: number;
  latencyMs: number | null;
  createdAt: string;
  subject: string;
}

export interface OverviewProduct {
  type: string;
  label: string;
  category: string;
  enabled: boolean;
  active: boolean;
  unitPriceKes: number | null;
  backupPriceKes: number | null;
  cbConsentRequired: boolean;
  requiresFileUpload: boolean;
  backupAvailable: boolean;
  live: boolean;
}

export interface OverviewAnalyticsPoint {
  label: string;
  value: number;
}

export interface OverviewAnalytics {
  points: OverviewAnalyticsPoint[];
  totalCost: number;
  avgLatencyMs: number | null;
  statusCounts: Record<string, number>;
}

export interface ServerAnalytics {
  dateRange: { from: string | null; to: string | null };
  totals: { verifications: number; cost: number; avgLatencyMs: number | null };
  statusCounts: Record<string, number>;
  productCounts: Record<string, number>;
  costByProduct: Record<string, number>;
  truncated: boolean;
}

export interface OverviewWallet {
  balance: number | null;
  currency: string;
  recentMovement?: number | null;
}

export interface OverviewData {
  stats: OverviewStats;
  recentItems: OverviewVerification[];
  products: OverviewProduct[];
  analytics?: OverviewAnalytics | null;
  wallet?: OverviewWallet | null;
}

// --- Pure helpers (tested) ---

export function formatMetricCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-KE').format(value);
}

export function formatCurrencyKes(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function getSuccessfulCount(items: Array<{ status: string }>): number {
  return items.filter((it) => it.status === 'success').length;
}

export function calculateSuccessRate(items: Array<{ status: string }>): number | null {
  if (items.length === 0) return null;
  const successful = getSuccessfulCount(items);
  return Math.round((successful / items.length) * 100);
}

export function classifyVerificationStatus(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'paid' || s === 'approved') return 'green';
  if (s === 'failed' || s === 'not_found' || s === 'rejected' || s === 'error') return 'red';
  if (s === 'pending' || s === 'processing') return 'amber';
  if (s === 'low' || s === 'info') return 'blue';
  return 'slate';
}

export function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'success') return 'Success';
  if (s === 'failed') return 'Failed';
  if (s === 'not_found') return 'Not found';
  if (s === 'pending') return 'Pending';
  if (s === 'processing') return 'Processing';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

export function summarizeRecentCost(items: Array<{ cost: number }>): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.cost) ? it.cost : 0), 0);
}

export function buildStatusDistribution(items: Array<{ status: string }>): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const it of items) {
    const k = it.status.toLowerCase();
    dist[k] = (dist[k] ?? 0) + 1;
  }
  return dist;
}

export function buildOverviewAnalytics(items: OverviewVerification[]): OverviewAnalytics {
  const totalCost = summarizeRecentCost(items);
  const latencies = items
    .map((it) => it.latencyMs)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const statusCounts = buildStatusDistribution(items);
  // Build a tiny series: last up to 8 items as points (oldest→newest) by cost
  const points: OverviewAnalyticsPoint[] = [...items]
    .slice(0, 8)
    .reverse()
    .map((it, idx) => ({ label: String(idx + 1), value: it.cost }));
  return { points, totalCost, avgLatencyMs, statusCounts };
}

export function getAvailableProducts(products: OverviewProduct[]): OverviewProduct[] {
  return products.filter((p) => p.enabled && p.active);
}

export function formatActivitySummary(analytics: OverviewAnalytics, total: number): string {
  if (total === 0) return 'No activity yet';
  const parts: string[] = [];
  if (analytics.statusCounts['success'])
    parts.push(`${analytics.statusCounts['success']} succeeded`);
  if (analytics.statusCounts['failed']) parts.push(`${analytics.statusCounts['failed']} failed`);
  if (analytics.statusCounts['not_found'])
    parts.push(`${analytics.statusCounts['not_found']} not found`);
  if (analytics.statusCounts['pending']) parts.push(`${analytics.statusCounts['pending']} pending`);
  const suffix = analytics.avgLatencyMs != null ? ` · avg ${analytics.avgLatencyMs}ms` : '';
  return parts.length ? `${parts.join(' · ')}${suffix}` : `${total} checks${suffix}`;
}

export function formatServerAnalyticsSummary(a: ServerAnalytics): string {
  if (a.totals.verifications === 0) return 'No verifications in the selected range';
  const parts: string[] = [];
  parts.push(`${formatMetricCount(a.totals.verifications)} verifications`);
  parts.push(formatCurrencyKes(a.totals.cost));
  if (a.totals.avgLatencyMs != null) parts.push(`avg ${a.totals.avgLatencyMs}ms`);
  return parts.join(' · ');
}

export function formatDateRangeLabel(dateRange: {
  from: string | null;
  to: string | null;
}): string {
  if (!dateRange.from && !dateRange.to) return 'All time';
  const fmt = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return s;
    }
  };
  if (dateRange.from && dateRange.to) return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
  if (dateRange.from) return `From ${fmt(dateRange.from)}`;
  return `Until ${fmt(dateRange.to!)}`;
}

export function toBarWidth(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}
