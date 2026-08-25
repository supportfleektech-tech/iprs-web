'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import type { IprsResult, VerificationResponse, VerificationType } from '@fleek/types';
import { VerificationType as VT } from '@fleek/types';
import { apiFetch, useAuth } from '@/lib/auth';

type Product = { type: VerificationType; enabled: boolean; priceMinor: string | null };

const PRODUCT_META: Record<VerificationType, { title: string; hint: string; fields: string[] }> = {
  iprs_id: { title: 'IPRS ID Verification', hint: 'National identity lookup', fields: ['idNumber'] },
  kra_pin: { title: 'KRA PIN Checker', hint: 'PIN validity & compliance', fields: ['kraPin', 'idNumber'] },
  phone_ownership: { title: 'Hakikisha / Phone Check', hint: 'Number ownership & M-Pesa KYC', fields: ['phoneNumber', 'idNumber'] },
  sim_swap: { title: 'SIM-swap Detection', hint: 'Fraud risk from SIM changes', fields: ['phoneNumber'] },
};

export default function VerifyPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<VerificationType>(VT.IPRS_ID);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<VerificationResponse<IprsResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    try {
      const list = await apiFetch<Product[]>('/verifications/products', { token });
      setProducts(list);
      setSelected((s) => s);
    } catch {
      // products endpoint is public; ignore failures silently in UI
    }
  }

  // Load once on mount
  useEffect(() => {
    void loadProducts();
  }, []);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = {
        type: selected,
        ...Object.fromEntries(Object.entries(inputs).filter(([, v]) => v !== '')),
        consent: true,
        consentCollectedBy: 'Fleek IPRS Console',
      };
      const res = await apiFetch<VerificationResponse<IprsResult>>('/verifications', {
        method: 'POST',
        body: JSON.stringify(body),
        token,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  const meta = PRODUCT_META[selected];
  const price = products.find((p) => p.type === selected)?.priceMinor;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Run a verification</h1>
      <p className="mb-6 text-sm text-slate-500">Sandbox mode — results come from the mock provider at zero cost until live keys are enabled.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(PRODUCT_META) as VerificationType[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelected(t);
              setInputs({});
              setResult(null);
              setError(null);
            }}
            className={`cursor-pointer rounded-xl border p-4 text-left transition-all ${
              selected === t
                ? 'border-teal-brand bg-teal-brand/5 ring-2 ring-teal-brand/40'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-semibold">{PRODUCT_META[t].title}</div>
            <div className="mt-0.5 text-xs text-slate-400">{PRODUCT_META[t].hint}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>
              Price: {price != null ? `KES ${Number(price) / 100}` : '—'} per successful check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onVerify} className="space-y-4">
              {meta.fields.map((field) => (
                <div key={field}>
                  <Label htmlFor={field}>
                    {field === 'idNumber' && 'National ID number'}
                    {field === 'kraPin' && 'KRA PIN (A#########Z)'}
                    {field === 'phoneNumber' && 'Phone number (07… / +2547…)'}
                    {meta.fields.length > 1 && field === 'idNumber' && selected !== 'iprs_id' && ' (optional)'}
                  </Label>
                  <Input
                    id={field}
                    required={field === 'idNumber' && selected === 'iprs_id'}
                    value={inputs[field] ?? ''}
                    onChange={(e) => setInputs((v) => ({ ...v, [field]: e.target.value }))}
                    placeholder={
                      field === 'idNumber' ? '12345678' : field === 'kraPin' ? 'A012345678Z' : '0712345678'
                    }
                  />
                </div>
              ))}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying…' : 'Verify now'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            {result && (
              <Badge tone={result.status === 'success' ? 'green' : result.status === 'not_found' ? 'amber' : 'red'}>
                {result.status.toUpperCase()}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {!result && !error && (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                Run a check to see the result here
              </div>
            )}
            {result?.status === 'success' && selected === 'iprs_id' && result.result && (
              <dl className="space-y-2 text-sm">
                {[
                  ['Full name', result.result.fullName],
                  ['ID number', result.result.idNumber],
                  ['Date of birth', result.result.dateOfBirth],
                  ['Gender', result.result.gender],
                  ['Citizenship', result.result.citizenship],
                  ['Serial number', result.result.serialNumber],
                  ['Place of birth', result.result.placeOfBirth],
                  ['Alive', result.result.aliveStatus ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium">{String(v ?? '—')}</dd>
                  </div>
                ))}
                <div className="pt-2 text-xs text-slate-400">
                  Cost KES {result.cost} · {new Date(result.createdAt).toLocaleString()}
                </div>
              </dl>
            )}
            {result?.status === 'success' && selected !== 'iprs_id' && result.result && (
              <pre className="max-h-64 overflow-auto rounded-lg bg-navy-950 p-4 text-xs leading-relaxed text-teal-light">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            )}
            {result && result.status !== 'success' && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                No conclusive result was returned. You were not charged.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
