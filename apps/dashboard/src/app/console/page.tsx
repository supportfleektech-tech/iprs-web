'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';
import { Overview, type OverviewProduct, type OverviewStats, type OverviewVerification } from './overview';

export default function ConsolePage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<OverviewStats>({ organizations: 0, verifications: 0, pendingTopUps: 0 });
  const [recentItems, setRecentItems] = useState<OverviewVerification[]>([]);
  const [products, setProducts] = useState<OverviewProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsResponse, recentResponse, productsResponse] = await Promise.all([
        apiFetch<OverviewStats>('/admin/stats', { token }),
        apiFetch<OverviewVerification[]>('/verifications?limit=10', { token }),
        apiFetch<OverviewProduct[]>('/verifications/products', { token }),
      ]);
      setStats(statsResponse);
      setRecentItems(recentResponse);
      setProducts(productsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load workspace data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Overview stats={stats} recentItems={recentItems} products={products} loading={loading} error={error} onRetry={() => void load()} />
  );
}
