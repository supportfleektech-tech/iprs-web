'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CardContent, Input, Label } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import type { VerificationType } from '@fleek/types';

interface HistoryItem {
  id: string;
  type: VerificationType;
  status: string;
  source: string;
  cost: number;
  latencyMs: number | null;
  createdAt: string;
  subject: string;
}

const TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  success: 'green',
  not_found: 'amber',
  failed: 'red',
  pending: 'slate',
};

export default function HistoryPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const qs = typeFilter ? `?type=${typeFilter}` : '';
    const res = await apiFetch<{ total: number; items: HistoryItem[] }>(`/verifications${qs}`, { token });
    setItems(res.items);
    setTotal(res.total);
  }, [token, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const header = 'id,type,status,cost_kes,latency_ms,subject,created_at\n';
    const rows = items
      .map((it) =>
        [it.id, it.type, it.status, it.cost, it.latencyMs ?? '', `"${it.subject}"`, it.createdAt].join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleek-verifications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Verification history</h1>
        <button
          onClick={exportCsv}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-400"
        >
          Export CSV
        </button>
      </div>

      <Card>
        <CardContent>
          <div className="mb-4 w-56">
            <Label htmlFor="filter">Filter by product</Label>
            <select
              id="filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm cursor-pointer"
            >
              <option value="">All products</option>
              <option value="iprs_id">IPRS ID Verification</option>
              <option value="kra_pin">KRA PIN Checker</option>
              <option value="phone_ownership">Hakikisha / Phone Check</option>
              <option value="sim_swap">SIM-swap Detection</option>
            </select>
          </div>

          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No verifications yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Subject</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-mono text-xs">{it.subject}</td>
                    <td className="py-2.5">{it.type.replace('_', ' ')}</td>
                    <td className="py-2.5">
                      <Badge tone={TONE[it.status] ?? 'slate'}>{it.status}</Badge>
                    </td>
                    <td className="py-2.5 text-slate-500">{it.source}</td>
                    <td className="py-2.5 text-right">{it.cost > 0 ? `KES ${it.cost}` : '—'}</td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {new Date(it.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Showing {items.length} of {total} records
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
