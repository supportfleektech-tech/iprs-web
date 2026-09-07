'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fleek/ui';
import { apiFetch } from '@/lib/auth';
import { VerificationType, PRODUCT_LABELS } from '@fleek/types';

interface VerificationDetail {
  id: string;
  type: VerificationType;
  status: string;
  source: string;
  consent: boolean;
  consentCollectedBy: string | null;
  cbConsent: boolean;
  isBackup: boolean;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  cost: number;
  latencyMs: number | null;
  createdAt: string;
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

function downloadCertificate(id: string) {
  return async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'}/exports/verifications/${id}/certificate`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    }
  };
}

export default function VerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<VerificationDetail>(`/verifications/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-slate-400">Loading verification…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Link href="/console/history" className="text-sm text-teal-brand hover:underline">
          ← Back to history
        </Link>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-slate-400">Verification not found.</p>
      </div>
    );
  }

  const inputEntries = Object.entries(detail.input).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  const resultEntries = detail.result
    ? Object.entries(detail.result).filter(([k]) => k !== 'photoBase64' && k !== 'referenceImageBase64')
    : [];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link href="/console/history" className="text-sm text-teal-brand hover:underline">
        ← Back to history
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{PRODUCT_LABELS[detail.type] ?? detail.type}</CardTitle>
              <CardDescription>
                {new Date(detail.createdAt).toLocaleString()} · source: {detail.source} · latency:{' '}
                {detail.latencyMs != null ? `${detail.latencyMs}ms` : '—'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={TONE[detail.status] ?? 'slate'}>{detail.status.toUpperCase()}</Badge>
              {detail.isBackup && <Badge tone="amber">via backup</Badge>}
              <Button variant="outline" size="sm" onClick={downloadCertificate(detail.id)}>
                Download certificate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Stat label="Cost" value={detail.cost > 0 ? `KES ${detail.cost.toLocaleString()}` : 'Free'} />
            <Stat label="Consent" value={detail.consent ? `Yes (by ${detail.consentCollectedBy ?? '—'})` : 'No'} />
            <Stat label="Credit-bureau consent" value={detail.cbConsent ? 'Provided' : 'Not required'} />
            <Stat label="Verification ID" value={detail.id} mono />
          </dl>

          {detail.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {detail.errorMessage}
            </div>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Input</h3>
            {inputEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No input captured.</p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {inputEntries.map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {humanise(k)}
                    </dt>
                    <dd className="mt-1 text-sm text-navy-900">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Result</h3>
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
                          ? <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(v, null, 2)}</pre>
                          : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm text-navy-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}