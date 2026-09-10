'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';
import { AdminCommandCenter } from './admin-command-center';
import type { AdminStats, AdminTopUp, ProductPricing, ProductPricingTier, OrgSummary } from '@/lib/admin';

export default function AdminPage() {
  const { token, user } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topUps, setTopUps] = useState<AdminTopUp[]>([]);
  const [products, setProducts] = useState<ProductPricing[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [tiers, setTiers] = useState<ProductPricingTier[]>([]);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch 6 endpoints in parallel — stats, top-ups, products, organizations, pricing, tiers
      const results = await Promise.allSettled([
        apiFetch<AdminStats>('/admin/stats', { token }),
        apiFetch<AdminTopUp[]>('/admin/top-ups', { token }),
        apiFetch<ProductPricing[]>('/admin/products', { token }),
        apiFetch<OrgSummary[]>('/admin/organizations', { token }),
        apiFetch<ProductPricing[]>('/admin/pricing', { token }),
        apiFetch<ProductPricingTier[]>('/admin/pricing/tiers', { token }),
      ]);

      const [statsRes, topUpsRes, productsRes, orgsRes, pricingRes, tiersRes] = results;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      else setStats(null);

      if (topUpsRes.status === 'fulfilled') setTopUps(topUpsRes.value);
      else setTopUps([]);

      if (productsRes.status === 'fulfilled') setProducts(productsRes.value);
      else setProducts([]);

      if (orgsRes.status === 'fulfilled') setOrgs(orgsRes.value);
      else setOrgs([]);

      if (pricingRes.status === 'fulfilled') setPricing(pricingRes.value);
      else setPricing([]);

      if (tiersRes.status === 'fulfilled') setTiers(tiersRes.value);
      else setTiers([]);

      // If critical endpoints failed, surface retryable error; org-scoped OWNER may lack some
      const criticalFailed = statsRes.status === 'rejected' && topUpsRes.status === 'rejected' && pricingRes.status === 'rejected';
      if (criticalFailed) {
        const msg = statsRes.status === 'rejected' ? (statsRes.reason as Error)?.message ?? 'Failed to load admin stats' : 'Failed to load admin data';
        setError(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin command center');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  // Auth gate — platform admin or org OWNER (per existing contract)
  if (!user?.isPlatformAdmin && user?.role !== 'OWNER') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4" role="status" aria-live="polite">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">Admin access required.</p>
          <p className="mt-1 text-xs text-slate-400">Platform administrator or organization owner only.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
      <AdminCommandCenter
        stats={stats}
        topUps={topUps}
        products={products}
        pricing={pricing}
        pricingTiers={tiers}
        organizations={orgs}
        token={token}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        onReload={() => load()}
      />
    </div>
  );
}
