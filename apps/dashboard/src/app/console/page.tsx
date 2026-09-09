'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, useAuth } from '@/lib/auth';
import { Overview } from './overview';
import type { OverviewStats, OverviewVerification, OverviewProduct, OverviewWallet } from '@/lib/overview';
import { LoadingState } from '@/components/loading-state';

interface HistoryResponse {
  total: number;
  items: OverviewVerification[];
}

interface WalletResponse {
  balance: number;
  currency: string;
}

interface TxResponse {
  items: Array<{ type: string; amount: number; createdAt: string }>;
}

export default function ConsoleOverviewPage() {
  const { token } = useAuth();

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentItems, setRecentItems] = useState<OverviewVerification[]>([]);
  const [products, setProducts] = useState<OverviewProduct[]>([]);
  const [wallet, setWallet] = useState<OverviewWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, historyRes, productsRes, walletRes] = await Promise.allSettled([
        apiFetch<OverviewStats>('/admin/stats', { token }),
        apiFetch<HistoryResponse>('/verifications?limit=8', { token }),
        apiFetch<OverviewProduct[]>('/verifications/products', { token }),
        apiFetch<WalletResponse>('/wallet', { token }),
      ]);

      let resolvedStats: OverviewStats;
      if (statsRes.status === 'fulfilled') {
        resolvedStats = statsRes.value;
      } else {
        const fallbackTotal = historyRes.status === 'fulfilled' ? historyRes.value.total : 0;
        resolvedStats = { organizations: 1, verifications: fallbackTotal, pendingTopUps: 0 };
      }
      setStats(resolvedStats);

      if (historyRes.status === 'fulfilled') {
        setRecentItems(historyRes.value.items);
        if (statsRes.status !== 'fulfilled' && historyRes.value.total > resolvedStats.verifications) {
          setStats({ ...resolvedStats, verifications: historyRes.value.total });
        }
      } else if (historyRes.status === 'rejected') {
        if (statsRes.status === 'rejected') {
          throw historyRes.reason instanceof Error ? historyRes.reason : new Error('Failed to load workspace data');
        }
        setRecentItems([]);
      }

      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value);
      } else {
        setProducts([]);
      }

      if (walletRes.status === 'fulfilled') {
        const w = walletRes.value;
        let movement: number | null = null;
        try {
          const tx = await apiFetch<TxResponse>('/wallet/transactions?limit=5', { token });
          if (tx.items.length) movement = tx.items[0]?.amount ?? null;
        } catch {
          movement = null;
        }
        setWallet({ balance: w.balance, currency: w.currency, recentMovement: movement });
      } else {
        setWallet(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, retryKey]);

  if (!stats && loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading overview" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Overview
        stats={stats ?? { organizations: 1, verifications: 0, pendingTopUps: 0 }}
        recentItems={recentItems}
        products={products}
        wallet={wallet}
        loading={loading}
        error={error}
        onRetry={() => setRetryKey((k) => k + 1)}
      />
    </div>
  );
}
