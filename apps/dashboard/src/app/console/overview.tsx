'use client';

import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fleek/ui';
import { DashboardIcon, type DashboardIconName } from '@/components/dashboard-icons';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { humanise, maskSubject } from '@/lib/verification-form';
import {
  calculateSuccessRate,
  getSuccessfulCount,
  summarizeRecentCost,
  formatCurrencyKes,
  formatMetricCount,
  getAvailableProducts,
  buildOverviewAnalytics,
  formatActivitySummary,
  type OverviewStats,
  type OverviewVerification,
  type OverviewProduct,
  type OverviewAnalytics,
  type OverviewWallet,
} from '@/lib/overview';

// Re-export for external consumers (Task 7 extends this file)
export type { OverviewStats, OverviewVerification, OverviewProduct, OverviewAnalytics, OverviewWallet };

export interface OverviewProps {
  stats: OverviewStats;
  recentItems: OverviewVerification[];
  products: OverviewProduct[];
  analytics?: OverviewAnalytics | null;
  wallet?: OverviewWallet | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function Overview({ stats, recentItems, products, analytics: analyticsProp, wallet, loading, error, onRetry }: OverviewProps) {
  const successful = getSuccessfulCount(recentItems);
  const successRate = calculateSuccessRate(recentItems);
  const recentCost = summarizeRecentCost(recentItems);
  const availableProducts = getAvailableProducts(products);
  const analytics = analyticsProp ?? buildOverviewAnalytics(recentItems);
  const activitySummary = formatActivitySummary(analytics, recentItems.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Operations overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 md:text-3xl">
            Good morning. Here is your verification workspace.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Monitor activity, run checks, and keep your organization ready for the next verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" /> API connected
          </span>
          <Link
            href="/console/verify"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none"
          >
            <DashboardIcon name="search" className="h-4 w-4" aria-hidden="true" /> Verify now
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-live="polite">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" aria-hidden="true" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert" aria-live="assertive">
          <div className="flex flex-wrap items-start gap-3">
            <DashboardIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-red-700">Workspace data could not be loaded</h2>
              <p className="mt-1 break-words text-sm text-red-700/80">{error}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={onRetry} className="h-11 shrink-0">
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="Workspace metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Available wallet balance"
              value={wallet?.balance != null ? formatCurrencyKes(wallet.balance) : '—'}
              hint={wallet?.recentMovement != null ? `Recent movement ${formatCurrencyKes(wallet.recentMovement)}` : 'Top up via M-Pesa, card, or bank'}
              icon="wallet"
              tone="navy"
            />
            <MetricCard
              label="Verification volume"
              value={formatMetricCount(stats.verifications)}
              hint="All verification records"
              icon="activity"
              tone="teal"
            />
            <MetricCard
              label="Recent success rate"
              value={successRate == null ? '—' : `${successRate}%`}
              hint={recentItems.length ? `${successful} of ${recentItems.length} recent checks succeeded` : 'No recent checks'}
              icon="check"
              tone="blue"
            />
            <MetricCard
              label="Recent verification cost"
              value={formatCurrencyKes(recentCost)}
              hint="Sum of recent checks"
              icon="card"
              tone="amber"
            />
          </section>

          {/* Compact activity strip — derived from available data only */}
          <section
            aria-label="Activity overview"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:px-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent activity</span>
                <span className="text-xs text-slate-400" aria-live="polite">
                  {activitySummary}
                </span>
              </div>
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {recentItems.length === 0 ? (
                  <span className="text-xs text-slate-400">No data to chart</span>
                ) : (
                  analytics.points.map((p, idx) => {
                    const max = Math.max(...analytics.points.map((q) => q.value), 1);
                    const h = p.value === 0 ? 4 : Math.max(8, Math.round((p.value / max) * 28));
                    return (
                      <span
                        key={idx}
                        className="w-2 rounded-full bg-teal-500/80 transition-[transform,opacity] duration-200 motion-reduce:transition-none"
                        style={{ height: `${h}px` }}
                        title={`KES ${p.value}`}
                      />
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
              {recentItems.slice(0, 8).map((it) => {
                const tone =
                  it.status === 'success' ? 'bg-teal-500' : it.status === 'failed' ? 'bg-red-500' : it.status === 'not_found' ? 'bg-amber-500' : 'bg-slate-300';
                return <span key={it.id} className={`h-2 w-2 rounded-full ${tone}`} title={it.status} />;
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.65fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>Recent verifications</CardTitle>
                    <CardDescription>Latest records from your organization.</CardDescription>
                  </div>
                  <Link
                    href="/console/history"
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-teal-500 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                  >
                    View history <DashboardIcon name="arrowRight" className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentItems.length === 0 ? (
                  <EmptyState
                    title="No verification activity yet"
                    description="Run your first check or upload a bulk file to start building your verification history."
                    action={{ label: 'Run a verification', href: '/console/verify' }}
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentItems.slice(0, 8).map((item) => (
                      <Link
                        key={item.id}
                        href={`/console/history/${item.id}`}
                        className="group flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-navy-900">{humanise(item.type)}</p>
                          <p className="truncate text-xs text-slate-400">
                            {maskSubject(item.subject)} · {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                        <span className="shrink-0 text-sm font-medium tabular-nums text-navy-900">
                          {item.cost > 0 ? formatCurrencyKes(item.cost) : 'Free'}
                        </span>
                        <DashboardIcon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-teal-600" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>Product availability</CardTitle>
                    <CardDescription>
                      {availableProducts.length} of {products.length} products ready to run.
                    </CardDescription>
                  </div>
                  <Link
                    href="/console/verify"
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                  >
                    Verify
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 p-3">
                {products.length === 0 ? (
                  <EmptyState title="No products loaded" description="Product availability is still being checked." />
                ) : (
                  <>
                    {products.slice(0, 8).map((product) => {
                      const available = product.enabled && product.active;
                      return (
                        <div
                          key={product.type}
                          className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-navy-900">{product.label}</p>
                            <p className="truncate text-xs text-slate-400">
                              {product.category} · {product.unitPriceKes != null ? formatCurrencyKes(product.unitPriceKes) : '—'}
                              {product.backupAvailable ? ' · backup available' : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {available ? (
                              <Badge tone="green">Active</Badge>
                            ) : (
                              <Badge tone="slate">Inactive</Badge>
                            )}
                            <Link
                              href="/console/verify"
                              aria-label={`Verify with ${product.label}`}
                              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
                                available
                                  ? 'bg-navy-900 text-white hover:bg-navy-800'
                                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
                              }`}
                              aria-disabled={!available}
                              tabIndex={!available ? -1 : undefined}
                              onClick={(e) => {
                                if (!available) e.preventDefault();
                              }}
                            >
                              Verify
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                    {products.length > 8 && (
                      <Link
                        href="/console/verify"
                        className="mt-1 block rounded-lg px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                      >
                        View all {products.length} products
                      </Link>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction icon="layers" title="Start a bulk batch" description="Upload up to 1,000 records and track progress in one place." href="/console/bulk" />
            <QuickAction icon="wallet" title="Manage wallet credit" description="Top up with M-Pesa, bank transfer, card, PayPal, or invoice." href="/console/wallet" />
            <QuickAction icon="clipboard" title="Review history" description="Filter, export, and open evidence records for every check." href="/console/history" />
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: DashboardIconName;
  tone: 'navy' | 'teal' | 'blue' | 'amber';
}) {
  const iconTone =
    tone === 'navy'
      ? 'bg-navy-900 text-white'
      : tone === 'teal'
        ? 'bg-teal-50 text-teal-700 ring-teal-100'
        : tone === 'blue'
          ? 'bg-blue-50 text-blue-700 ring-blue-100'
          : 'bg-amber-50 text-amber-700 ring-amber-100';
  return (
    <Card className="overflow-hidden p-0">
      <div className="p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${iconTone}`} aria-hidden="true">
          <DashboardIcon name={icon} className="h-5 w-5" />
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums text-navy-900">{value}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{hint}</p>
      </div>
    </Card>
  );
}

function QuickAction({ icon, title, description, href }: { icon: DashboardIconName; title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow,transform,opacity] duration-200 hover:border-teal-300 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100" aria-hidden="true">
        <DashboardIcon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{description}</p>
      </div>
      <DashboardIcon name="arrowRight" className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-teal-600" aria-hidden="true" />
    </Link>
  );
}
