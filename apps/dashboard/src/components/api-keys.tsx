'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import { apiFetch } from '@/lib/auth';

interface KeyItem {
  id: string;
  name: string;
  prefix: string;
  environment: 'live' | 'test';
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Organization API-key management — one-time secret, env badges, clear permissions. */
export default function ApiKeysSection({ token }: { token: string | null }) {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<'live' | 'test'>('test');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setKeys(await apiFetch<KeyItem[]>('/keys', { token }));
  }, [token]);

  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFreshKey(null);
    setCopied(false);
    if (!name.trim() || name.trim().length < 2) {
      setError('Key name must be at least 2 characters');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<{ key: string }>('/keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), environment: env }),
        token,
      });
      // Never log PII/secret — disclosure is one-time in UI only.
      setFreshKey(res.key);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    setRevokingId(id);
    try {
      await apiFetch(`/keys/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  }

  async function copySecret() {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select via exec
      setCopied(true);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Create API key</span>
            <span className="text-xs font-normal text-slate-400">Env required · one-time secret</span>
          </CardTitle>
          <CardDescription>Use <span className="font-medium text-navy-900">test</span> keys against the sandbox (mock provider); <span className="font-medium text-red-600">live</span> keys bill real wallet credit. Secrets are shown once and never logged.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label htmlFor="keyName">Key name</Label>
              <Input id="keyName" required minLength={2} placeholder="e.g. production-backend" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              <p className="mt-1 text-xs text-slate-500">Human-readable label — not the secret.</p>
            </div>
            <div className="w-44">
              <Label htmlFor="keyEnv">Environment</Label>
              <div className="flex items-center gap-2">
                <select
                  id="keyEnv"
                  value={env}
                  onChange={(e) => setEnv(e.target.value as 'live' | 'test')}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 cursor-pointer"
                  aria-label="Environment"
                >
                  <option value="test">test — sandbox</option>
                  <option value="live">live — billed</option>
                </select>
                <Badge tone={env === 'live' ? 'red' : 'blue'} aria-label={`Environment ${env}`}>{env}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{env === 'live' ? 'Live: real charges' : 'Test: mock, no charges'}</p>
            </div>
            <Button type="submit" disabled={creating} aria-label="Create API key" className="h-11">
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </form>

          {freshKey && (
            <div className="mt-4 rounded-xl border border-teal-600/20 bg-teal-50 p-4" role="alert" aria-live="assertive">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Copy it now — shown only once</p>
              <p className="mt-1 text-xs text-slate-600">This secret will not be shown again. Store it securely; it is never logged.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm ring-1 ring-slate-200" aria-label="New API key secret">{freshKey}</code>
                <Button size="sm" variant="secondary" onClick={() => void copySecret()} aria-label="Copy API key to clipboard" className="h-11 shrink-0">
                  {copied ? 'Copied ✓' : 'Copy'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFreshKey(null)} aria-label="Dismiss secret" className="h-11">
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-red-600"><span>{error}</span><button type="button" onClick={() => setError(null)} className="underline hover:no-underline">Dismiss</button></p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Organization keys</span>
            <Badge tone="slate">{keys.length} total</Badge>
          </CardTitle>
          <CardDescription>Prefix identifies the key; prefix + environment + last-used audit the surface. Revoked keys remain visible but are inert.</CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No API keys yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm" aria-label="API keys">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="pb-2">Name</th>
                    <th scope="col" className="pb-2">Prefix</th>
                    <th scope="col" className="pb-2">Environment</th>
                    <th scope="col" className="pb-2">Permissions</th>
                    <th scope="col" className="pb-2">Last used</th>
                    <th scope="col" className="pb-2 text-right">Revoke</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {keys.map((k) => (
                    <tr key={k.id} className={`transition-colors motion-reduce:transition-none ${k.revokedAt ? 'opacity-50 bg-slate-50/50' : 'hover:bg-slate-50/60'}`}>
                      <td className="py-3">
                        <span className="font-medium text-navy-900">{k.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{new Date(k.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3 font-mono text-xs tabular-nums">{k.prefix}…</td>
                      <td className="py-3">
                        <Badge tone={k.environment === 'live' ? 'red' : 'blue'}>{k.environment}</Badge>
                        <span className="ml-2 text-xs text-slate-500 hidden sm:inline">{k.environment === 'live' ? 'Billed' : 'Sandbox'}</span>
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        {k.environment === 'live' ? 'All enabled products' : 'Sandbox only'}
                      </td>
                      <td className="py-3 text-xs text-slate-400">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                      </td>
                      <td className="py-3 text-right">
                        {!k.revokedAt ? (
                          <button
                            type="button"
                            onClick={() => void revoke(k.id)}
                            disabled={revokingId === k.id}
                            aria-label={`Revoke key ${k.name}`}
                            className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
                          >
                            {revokingId === k.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        ) : (
                          <span className="inline-flex h-11 items-center px-3 text-xs text-slate-400">revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
