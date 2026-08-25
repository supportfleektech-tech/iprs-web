'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { parseCsv, csvRowsToInputs, toCsv, type CsvRow } from '@/lib/csv';


interface BatchSummary {
  id: string;
  type: string;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  notFoundCount: number;
  errorMessage: string | null;
  createdAt: string;
}

interface BatchResultRow {
  subject: string;
  status: string;
  name: string;
  detail: string;
  cost: number;
}

const PRODUCT_FIELDS: Record<string, { label: string; columnHint: string; price: number }> = {
  iprs_id: { label: 'IPRS ID Verification', columnHint: 'id_number', price: 50 },
  kra_pin: { label: 'KRA PIN Checker', columnHint: 'kra_pin', price: 30 },
  phone_ownership: { label: 'Hakikisha / Phone Check', columnHint: 'phone_number', price: 20 },
  sim_swap: { label: 'SIM-swap Detection', columnHint: 'phone_number', price: 20 },
};

export default function BulkPage() {
  const { token } = useAuth();
  const [type, setType] = useState('iprs_id');
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchSummary | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBatches = useCallback(async () => {
    if (!token) return;
    setBatches(await apiFetch<BatchSummary[]>('/verifications/batches', { token }));
  }, [token]);

  useEffect(() => {
    void loadBatches().catch(() => undefined);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadBatches]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setRows(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) {
      setParseError('File too large (max 2 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const records = parseCsv(String(reader.result ?? ''));
        const inputs = csvRowsToInputs(records).filter((r) => r.idNumber || r.phoneNumber || r.kraPin);
        if (inputs.length === 0) throw new Error('No usable rows found — include a header like id_number or phone_number');
        if (inputs.length > 1000) throw new Error(`Too many rows (${inputs.length}) — max is 1000 per batch`);
        setRows(inputs);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Could not parse CSV');
      }
    };
    reader.readAsText(file);
  }

  async function startBatch() {
    if (!rows) return;
    setError(null);
    try {
      const summary = await apiFetch<BatchSummary>('/verifications/batches', {
        method: 'POST',
        body: JSON.stringify({ type, consentCollectedBy: 'Fleek IPRS Console (bulk)', rows }),
        token,
      });
      setActiveBatch(summary);
      setRows(null);
      setFileName('');
      // Poll until the batch finishes
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await apiFetch<BatchSummary>(`/verifications/batches/${summary.id}`, { token });
        setActiveBatch(s);
        if (s.status !== 'processing') {
          if (pollRef.current) clearInterval(pollRef.current);
          void loadBatches();
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch');
    }
  }

  async function downloadResults(batchId: string) {
    const results = await apiFetch<BatchResultRow[]>(`/verifications/batches/${batchId}/results`, { token });
    const csv = toCsv(
      ['subject', 'status', 'name', 'detail', 'cost_kes'],
      results.map((r) => [r.subject, r.status, r.name, r.detail, r.cost]),
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batchId.slice(-8)}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const meta = PRODUCT_FIELDS[type];
  const estimated = rows ? (rows.length * meta.price).toLocaleString() : '0';

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Bulk verification</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload a CSV of up to 1,000 rows. Include a header row with{' '}
        <code className="rounded bg-slate-100 px-1">id_number</code>,{' '}
        <code className="rounded bg-slate-100 px-1">phone_number</code> or{' '}
        <code className="rounded bg-slate-100 px-1">kra_pin</code>.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>New batch</CardTitle>
          <CardDescription>
            Every row is billed individually; inconclusive lookups are free.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Product</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm cursor-pointer"
              >
                {Object.entries(PRODUCT_FIELDS).map(([value, m]) => (
                  <option key={value} value={value}>
                    {m.label} — KES {m.price}/check
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-xs file:text-white hover:file:bg-navy-800"
              />
            </div>
          </div>

          {parseError && <p className="mt-3 text-xs text-red-500">{parseError}</p>}
          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

          {rows && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-teal-brand/5 border border-teal-brand/30 px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span> — {rows.length.toLocaleString()} rows ·
                estimated cost <span className="font-semibold">KES {estimated}</span>
              </div>
              <Button onClick={() => void startBatch()}>Start batch</Button>
            </div>
          )}
          {!rows && !parseError && (
            <p className="mt-4 text-xs text-slate-400">
              Expected column for this product: <strong>{meta.columnHint}</strong>
            </p>
          )}

          {activeBatch && (
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Batch …{activeBatch.id.slice(-8)}{' '}
                  <Badge tone={activeBatch.status === 'completed' ? 'green' : activeBatch.status === 'failed' ? 'red' : 'blue'}>
                    {activeBatch.status}
                  </Badge>
                </span>
                <span className="text-slate-400">
                  {activeBatch.processedRows}/{activeBatch.totalRows} processed
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-teal-brand transition-all duration-500"
                  style={{ width: `${Math.round((activeBatch.processedRows / Math.max(activeBatch.totalRows, 1)) * 100)}%` }}
                />
              </div>
              {activeBatch.status === 'processing' && (
                <p className="mt-2 text-xs text-slate-400">Processing… you can leave this page and check history later.</p>
              )}
              {activeBatch.status === 'completed' && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    ✓ {activeBatch.successCount} verified · ⚠ {activeBatch.notFoundCount} not found · ✕ {activeBatch.failedCount} failed
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => void downloadResults(activeBatch.id)}>
                    Download results CSV
                  </Button>
                </div>
              )}
              {activeBatch.errorMessage && (
                <p className="mt-2 text-xs text-red-500">{activeBatch.errorMessage}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Past batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No batches yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Batch</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Rows</th>
                  <th className="pb-2 text-right">✓ / ⚠ / ✕</th>
                  <th className="pb-2 text-right">When</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-mono text-xs">…{b.id.slice(-8)}</td>
                    <td className="py-2.5">{PRODUCT_FIELDS[b.type]?.label ?? b.type}</td>
                    <td className="py-2.5 text-right">{b.totalRows}</td>
                    <td className="py-2.5 text-right">
                      {b.successCount} / {b.notFoundCount} / {b.failedCount}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      {b.status === 'completed' && (
                        <button
                          onClick={() => void downloadResults(b.id)}
                          className="cursor-pointer text-xs text-teal-brand hover:underline"
                        >
                          Results CSV
                        </button>
                      )}
                      {b.status === 'processing' && (
                        <Link href="/console/bulk" className="text-xs text-slate-400">
                          running…
                        </Link>
                      )}
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
