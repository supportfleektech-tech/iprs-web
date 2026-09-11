'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@fleek/ui';
import { apiFetch } from '@/lib/auth';
import { PRODUCT_LABELS, VERIFICATION_TYPES } from '@fleek/types';
import {
  AdminStats,
  AdminTopUp,
  ProductPricing,
  ProductPricingTier,
  OrgSummary,
  formatPriceMinor,
  formatCount,
  requiresCbConsent,
  requiresFileUpload,
  getProductCategory,
} from '@/lib/admin';
import { PriceEditor } from '@/components/price-editor';
import { OrgManagement } from '@/components/org-management';
import ApiKeysSection from '@/components/api-keys';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';

export interface AdminCommandCenterProps {
  stats: AdminStats | null;
  topUps: AdminTopUp[];
  products: ProductPricing[];
  pricing: ProductPricing[];
  pricingTiers: ProductPricingTier[];
  organizations: OrgSummary[];
  token: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onReload: () => Promise<void>;
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'teal' | 'amber' | 'slate';
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-navy-900 tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {tone === 'amber' && (
          <span
            className="mt-2 inline-flex h-1 w-full rounded bg-amber-500/60"
            aria-hidden="true"
          />
        )}
        {tone === 'teal' && (
          <span className="mt-2 inline-flex h-1 w-full rounded bg-teal-500/60" aria-hidden="true" />
        )}
      </CardContent>
    </Card>
  );
}

export function AdminCommandCenter({
  stats,
  topUps,
  products,
  pricing,
  pricingTiers,
  organizations,
  token,
  loading,
  error,
  onRetry,
  onReload,
}: AdminCommandCenterProps) {
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  const [activeSaving, setActiveSaving] = useState<string | null>(null);
  const [activeMsg, setActiveMsg] = useState<Record<string, string>>({});
  const [activeErr, setActiveErr] = useState<Record<string, string>>({});

  // Prefer products endpoint; fallback to pricing if products empty
  const catalog: ProductPricing[] = products.length > 0 ? products : pricing;
  // Map pricing for quick lookup
  const pricingByType = new Map(pricing.map((p) => [p.type, p]));
  // Collect all backup prices per product to avoid first-wins misrepresentation (I-1)
  const backupByType = new Map<string, number[]>();
  for (const t of pricingTiers) {
    if (t.backupPriceMinor != null) {
      const n = Number(t.backupPriceMinor);
      if (Number.isFinite(n)) {
        const arr = backupByType.get(t.productType) ?? [];
        arr.push(n);
        backupByType.set(t.productType, arr);
      }
    }
  }
  function getBackupLabel(productType: string): string {
    const vals = backupByType.get(productType) ?? [];
    if (vals.length === 0) return '—';
    const unique = [...new Set(vals)].sort((a, b) => a - b);
    if (unique.length === 1) return formatPriceMinor(unique[0]);
    // Heterogeneous backups across tiers — show range lower bound to avoid misleading single value
    return `from ${formatPriceMinor(unique[0])}`;
  }
  function hasHeterogeneousBackup(productType: string): boolean {
    const vals = backupByType.get(productType) ?? [];
    return new Set(vals).size > 1;
  }

  async function review(id: string, approve: boolean) {
    setReviewBusy(id + (approve ? '-approve' : '-reject'));
    setReviewMsg(null);
    setReviewErr(null);
    try {
      await apiFetch(`/admin/top-ups/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
        token,
      });
      setReviewMsg(approve ? 'Top-up approved and credited' : 'Top-up rejected');
      await onReload();
    } catch (e) {
      setReviewErr(e instanceof Error ? `${e.message} — retry` : 'Failed — retry');
    } finally {
      setReviewBusy(null);
    }
  }

  async function toggleActive(type: string, currentActive: boolean) {
    setActiveSaving(type);
    setActiveMsg((s) => ({ ...s, [type]: '' }));
    setActiveErr((s) => ({ ...s, [type]: '' }));
    try {
      await apiFetch(`/admin/products/${type}/active`, {
        method: 'PUT',
        body: JSON.stringify({ active: !currentActive }),
        token,
      });
      setActiveMsg((s) => ({ ...s, [type]: !currentActive ? 'Activated' : 'Deactivated' }));
      await onReload();
    } catch (e) {
      setActiveErr((s) => ({
        ...s,
        [type]: e instanceof Error ? `${e.message} — retry` : 'Failed — retry',
      }));
    } finally {
      setActiveSaving(null);
    }
  }

  async function handleSavePricing(type: string, priceKes: number) {
    await apiFetch('/admin/pricing', {
      method: 'POST',
      body: JSON.stringify({ type, price: priceKes }),
      token,
    });
    await onReload();
  }

  async function handleUpdateTier(
    id: string,
    dto: { unitPriceMinor?: number; backupPriceMinor?: number | null },
  ) {
    await apiFetch(`/admin/pricing/tiers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
      token,
    });
    await onReload();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div
                  className="h-3 w-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <div
                  className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          ))}
        </div>
        <LoadingState label="Loading command center" />
      </div>
    );
  }

  const pending = topUps.filter((t) => t.status === 'pending');
  const totalOrgs = stats?.organizations ?? organizations.length;

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-medium text-red-700">{error}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="secondary"
              className="h-9 shrink-0"
              aria-label="Retry loading admin command center"
            >
              Retry
            </Button>
          )}
        </div>
      )}
      {/* Header + KPIs — first viewport */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 font-display">
          Admin — platform command center
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vault-grade operations: stats, top-ups, product catalog, pricing tiers, organization
          overrides, and API keys. All amounts VAT-exclusive unless noted.
        </p>
      </div>

      <section aria-label="Platform KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Organizations"
          value={formatCount(totalOrgs)}
          hint="Registered orgs"
          tone="teal"
        />
        <StatCard
          label="Verifications"
          value={formatCount(stats?.verifications ?? null)}
          hint="Lifetime checks"
          tone="slate"
        />
        <StatCard
          label="Pending top-ups"
          value={formatCount(stats?.pendingTopUps ?? pending.length)}
          hint={`${pending.length} awaiting decision`}
          tone={pending.length > 0 ? 'amber' : 'slate'}
        />
      </section>

      {/* Pending top-up queue with org context */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Top-up review queue</span>
            <Badge tone={pending.length > 0 ? 'amber' : 'slate'}>{pending.length} pending</Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">
            Approve & credit or reject with explicit action. Organization context shown for each
            request.
          </p>
        </CardHeader>
        <CardContent>
          {reviewMsg && (
            <p
              role="status"
              aria-live="polite"
              className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-100"
            >
              {reviewMsg}
            </p>
          )}
          {reviewErr && (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <span>{reviewErr}</span>
              <button
                type="button"
                onClick={() => void onReload()}
                className="ml-2 inline-flex h-7 items-center rounded-lg border border-red-200 bg-white px-2 text-xs font-medium hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              >
                Retry
              </button>
            </div>
          )}
          {topUps.length === 0 ? (
            <EmptyState
              title="Nothing pending"
              description="No top-up requests. Approved and rejected items appear in the ledger when created."
            />
          ) : (
            <ul className="space-y-3" aria-label="Top-up requests">
              {topUps.map((t) => {
                const isPending = t.status === 'pending';
                const amountLabel = formatPriceMinor(t.amountMinor);
                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50/40 motion-reduce:transition-none"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-900 tabular-nums">
                          {amountLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Org{' '}
                          <span className="font-medium text-navy-900">
                            {t.organization?.name ?? t.organizationId}
                          </span>
                          <span className="mx-1">·</span>
                          {new Date(t.createdAt).toLocaleString()}
                        </p>
                        {t.adminNote && (
                          <p className="mt-1 text-xs text-slate-500">Note: {t.adminNote}</p>
                        )}
                      </div>
                      <Badge
                        tone={
                          t.status === 'approved'
                            ? 'green'
                            : t.status === 'rejected'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {t.status}
                      </Badge>
                    </div>
                    {isPending && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => void review(t.id, true)}
                          disabled={reviewBusy !== null}
                          aria-label={`Approve and credit ${amountLabel} for ${t.organization?.name ?? t.organizationId}`}
                          className="h-11"
                        >
                          {reviewBusy === t.id + '-approve' ? 'Approving…' : 'Approve & credit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void review(t.id, false)}
                          disabled={reviewBusy !== null}
                          aria-label={`Reject ${amountLabel} for ${t.organization?.name ?? t.organizationId}`}
                          className="h-11"
                        >
                          {reviewBusy === t.id + '-reject' ? 'Rejecting…' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Product catalog with active switches, pricing, backup, consent/upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Product catalog</span>
            <Badge tone="slate">
              {catalog.length} / {VERIFICATION_TYPES.length} products
            </Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">
            Active toggle controls availability. Pricing shows current minor-unit price
            (VAT-exclusive). Backup, consent, and upload indicators are vault-grade compliance
            surfaces.
          </p>
        </CardHeader>
        <CardContent>
          {catalog.length === 0 ? (
            <EmptyState
              title="No product pricing"
              description="No product pricing records returned. Check /admin/pricing and /admin/products endpoints."
            />
          ) : (
            <ul className="space-y-2" aria-label="Product catalog">
              {catalog.map((p) => {
                const label = (PRODUCT_LABELS as Record<string, string>)[p.type] ?? p.type;
                const category = getProductCategory(p.type);
                const cbRequired = requiresCbConsent(p.type);
                const fileUpload = requiresFileUpload(p.type);
                const backupLabel = getBackupLabel(p.type);
                const heterogeneous = hasHeterogeneousBackup(p.type);
                const simplePricing = pricingByType.get(p.type);
                const displayPrice = formatPriceMinor(
                  p.priceMinor ?? simplePricing?.priceMinor ?? 0,
                );
                return (
                  <li key={p.type} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy-900">{label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span className="font-mono text-xs">{p.type}</span> · {category}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge tone={p.active ? 'green' : 'red'}>
                            {p.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {cbRequired && <Badge tone="amber">CB consent required</Badge>}
                          {fileUpload && <Badge tone="blue">File upload</Badge>}
                          <Badge tone="slate">
                            {displayPrice} {p.active ? '' : '(inactive)'}
                          </Badge>
                          <Badge
                            tone="slate"
                            title={
                              heterogeneous
                                ? 'Backup varies by tier — see tier editor for per-tier values'
                                : undefined
                            }
                          >
                            Backup {backupLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors motion-reduce:transition-none">
                          <input
                            type="checkbox"
                            checked={p.active}
                            onChange={() => void toggleActive(p.type, p.active)}
                            disabled={activeSaving === p.type}
                            aria-label={`${p.type} active`}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-cyan-600"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            {activeSaving === p.type ? 'Saving…' : p.active ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </div>
                    </div>
                    {activeMsg[p.type] && (
                      <p role="status" aria-live="polite" className="mt-2 text-xs text-teal-700">
                        {activeMsg[p.type]}
                      </p>
                    )}
                    {activeErr[p.type] && (
                      <p role="alert" className="mt-2 flex items-center gap-2 text-xs text-red-600">
                        <span>{activeErr[p.type]}</span>
                        <button
                          type="button"
                          onClick={() => void toggleActive(p.type, p.active)}
                          className="inline-flex h-7 items-center rounded-lg border border-red-200 px-2 text-xs font-medium hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                        >
                          Retry
                        </button>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Global tier editor — backup per-tier shown here (I-1 detail) */}
      <PriceEditor
        tiers={pricingTiers}
        pricing={pricing}
        onSavePricing={handleSavePricing}
        onUpdateTier={handleUpdateTier}
      />

      {/* Org table + per-org controls */}
      <OrgManagement organizations={organizations} token={token} onReloadOrgs={onReload} />

      {/* API keys */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy-900">API keys</h2>
        <ApiKeysSection token={token} />
      </div>
    </div>
  );
}
