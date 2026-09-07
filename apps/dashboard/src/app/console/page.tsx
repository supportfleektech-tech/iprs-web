'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';

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

const TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  success: 'green',
  not_found: 'amber',
  failed: 'red',
  pending: 'slate',
};

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export default function VerifyPage() {
  const { token } = useAuth();
  const [idNumber, setIdNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  const resultEntries = detail?.result
    ? Object.entries(detail.result).filter(([k]) => k !== 'photoBase64' && k !== 'referenceImageBase64')
    : [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Run a verification</h1>
      <p className="mb-6 text-sm text-slate-500">Sandbox mode</p>

      <Card>
        <CardHeader>
          <CardTitle>IPRS identity check</CardTitle>
          <CardDescription>Look up a national ID number against the registry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={runCheck} className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label htmlFor="idNumber">National ID number</Label>
              <Input
                id="idNumber"
                required
                inputMode="numeric"
                placeholder="12345678"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy || idNumber.trim().length === 0}>
              {busy ? 'Verifying…' : 'Verify now'}
            </Button>
          </form>
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {detail && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Result</CardTitle>
              <Badge tone={TONE[detail.status] ?? 'slate'}>{detail.status.toUpperCase()}</Badge>
            </div>
            <CardDescription>
              Cost KES {detail.cost.toLocaleString()} ·{' '}
              <Link href={`/console/history/${detail.id}`} className="text-teal-brand hover:underline">
                View full detail
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detail.errorMessage && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {detail.errorMessage}
              </div>
            )}
            {resultEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No result payload.</p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {resultEntries.map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {humanise(k)}
                    </dt>
                    <dd className="mt-1 text-sm text-navy-900">
                      {v === null || v === undefined
                        ? '—'
                        : typeof v === 'object'
                          ? JSON.stringify(v)
                          : String(v)}
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
