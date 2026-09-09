'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { Overview } from './overview';
import type { OverviewStats, OverviewVerification, OverviewProduct, OverviewWallet } from '@/lib/overview';
import { LoadingState } from '@/components/loading-state';

interface RunResponse {
  id: string;
  status: string;
}

interface VerificationDetail {
  id: string;
  type: string;
  status: string;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  cost: number;
}

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

const TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  success: 'green',
  not_found: 'amber',
  failed: 'red',
  pending: 'slate',
};

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export default function ConsoleOverviewPage() {
  const { token } = useAuth();

  // Overview state
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recentItems, setRecentItems] = useState<OverviewVerification[]>([]);
  const [products, setProducts] = useState<OverviewProduct[]>([]);
  const [wallet, setWallet] = useState<OverviewWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Quick verify state (IPRS standard)
  const [idNumber, setIdNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

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

      // Stats — fallback to derived total on 403 / non-platform-admin
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
        // If stats were fallback with 0, patch verifications to history total if larger
        if (statsRes.status !== 'fulfilled' && historyRes.value.total > resolvedStats.verifications) {
          setStats({ ...resolvedStats, verifications: historyRes.value.total });
        }
      } else if (historyRes.status === 'rejected') {
        // History fetch failure is not fatal for stats, but if both stats and history failed, surface error
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
        // Fetch recent movement in background — non-blocking
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

  // Per-org product availability for quick verify
  useEffect(() => {
    if (!token) return;
    apiFetch<OverviewProduct[]>('/verifications/products', { token })
      .then((list) => setAvailable(list.find((p) => p.type === 'iprs_standard')?.enabled ?? true))
      .catch(() => setAvailable(true));
  }, [token]);

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setVerifyError(null);
    setDetail(null);
    try {
      const run = await apiFetch<RunResponse>('/verifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'iprs_standard',
          idNumber: idNumber.trim(),
          consent: true,
          consentCollectedBy: 'console',
        }),
        token,
      });
      const full = await apiFetch<VerificationDetail>(`/verifications/${run.id}`, { token });
      setDetail(full);
      // Refresh recent list in background
      void loadOverview();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  const resultEntries = detail?.result
    ? Object.entries(detail.result).filter(([k]) => k !== 'photoBase64' && k !== 'referenceImageBase64')
    : [];

  // Initial auth loading handled by layout; this page handles data loading.
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

      <Card>
        <CardHeader>
          <CardTitle>Quick verify — IPRS identity check</CardTitle>
          <CardDescription>Look up a national ID number against the registry. For all 24 products, open the verification workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {available === false ? (
            <p className="text-sm text-slate-500">IPRS checks are not enabled for your organization. Contact your administrator.</p>
          ) : (
            <form onSubmit={runCheck} className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-64">
                <Label htmlFor="idNumber">National ID number</Label>
                <Input
                  id="idNumber"
                  required
                  inputMode="numeric"
                  placeholder="12345678"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  aria-describedby="idNumber-hint"
                />
                <p id="idNumber-hint" className="mt-1 text-xs text-slate-400">
                  Consent is recorded as collected by console.
                </p>
              </div>
              <Button type="submit" disabled={busy || idNumber.trim().length === 0} className="h-11">
                {busy ? 'Verifying…' : 'Verify now'}
              </Button>
              <Link
                href="/console/verify"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:border-teal-500 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              >
                Open verification workspace
              </Link>
            </form>
          )}
          {verifyError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
              {verifyError}
            </div>
          )}
        </CardContent>
      </Card>

      {detail && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Result</CardTitle>
              <Badge tone={TONE[detail.status] ?? 'slate'}>{detail.status.toUpperCase()}</Badge>
            </div>
            <CardDescription>
              Cost KES {detail.cost.toLocaleString()} ·{' '}
              <Link href={`/console/history/${detail.id}`} className="font-medium text-teal-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
                View full detail
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.errorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                {detail.errorMessage}
              </div>
            )}
            {resultEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No result payload.</p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {resultEntries.map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{humanise(k)}</dt>
                    <dd className="mt-1 break-words text-sm text-navy-900">
                      {v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
