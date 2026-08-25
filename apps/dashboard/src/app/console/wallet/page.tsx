'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';

interface Tx {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface TopUp {
  id: string;
  amountMinor: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const { token, user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!token) return;
    const bal = await apiFetch<{ balance: number; currency: string }>('/wallet', { token });
    setBalance(bal.balance);
    const ledger = await apiFetch<{ items: Tx[] }>('/wallet/transactions', { token });
    setTxs(ledger.items);
    if (canManage) {
      const reqs = await apiFetch<TopUp[]>('/wallet/top-ups', { token });
      setTopUps(reqs);
    }
  }, [token, canManage]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function requestTopUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await apiFetch('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
        token,
      });
      setMsg('Top-up requested. Fleektech will issue an invoice; the wallet is credited on approval.');
      setAmount('');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold font-display">Wallet</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 bg-navy-900 text-white border-navy-900">
          <p className="text-sm text-slate-300">Available balance</p>
          <p className="mt-1 text-3xl font-bold brand-gradient-text">
            {balance != null ? `KES ${balance.toLocaleString()}` : '…'}
          </p>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Request credit</CardTitle>
            <CardDescription>Manual invoicing — minimum KES 1,000.</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={requestTopUp} className="flex gap-3">
                <div className="w-40">
                  <Input
                    required
                    type="number"
                    min={1000}
                    step={500}
                    placeholder="Amount (KES)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button type="submit">Request invoice</Button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Only Owners/Admins can request top-ups.</p>
            )}
            {msg && <p className="mt-3 text-xs text-teal-brand">{msg}</p>}

            {topUps.length > 0 && (
              <ul className="mt-5 space-y-2">
                {topUps.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>KES {(Number(t.amountMinor) / 100).toLocaleString()}</span>
                    <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                    <Badge
                      tone={t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'amber'}
                    >
                      {t.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Balance after</th>
                  <th className="pb-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5">{t.description ?? '—'}</td>
                    <td className="py-2.5">
                      <Badge tone={t.type === 'topup' ? 'green' : 'blue'}>{t.type}</Badge>
                    </td>
                    <td className={`py-2.5 text-right font-medium ${t.type === 'topup' ? 'text-emerald-600' : ''}`}>
                      {t.type === 'topup' ? '+' : '−'}KES {Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">
                      KES {t.balanceAfter.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
