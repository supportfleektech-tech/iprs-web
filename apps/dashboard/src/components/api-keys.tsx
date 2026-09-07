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

/** Organization API-key management. Rendered on the admin page only. */
export default function ApiKeysSection({ token }: { token: string | null }) {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<'live' | 'test'>('test');
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const res = await apiFetch<{ key: string }>('/keys', {
        method: 'POST',
        body: JSON.stringify({ name, environment: env }),
        token,
      });
      setFreshKey(res.key);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/keys/${id}`, { method: 'DELETE', token });
    await load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create key</CardTitle>
          <CardDescription>Use test keys against the sandbox; live keys bill real wallet credit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label htmlFor="keyName">Key name</Label>
              <Input id="keyName" required minLength={2} placeholder="e.g. production-backend" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-36">
              <Label htmlFor="keyEnv">Environment</Label>
              <select
                id="keyEnv"
                value={env}
                onChange={(e) => setEnv(e.target.value as 'live' | 'test')}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm cursor-pointer"
              >
                <option value="test">test (sandbox)</option>
                <option value="live">live</option>
              </select>
            </div>
            <Button type="submit">Create key</Button>
          </form>

          {freshKey && (
            <div className="mt-4 rounded-lg border border-teal-brand/40 bg-teal-brand/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-brand">Copy it now — shown only once</p>
              <code className="mt-1 block break-all font-mono text-sm">{freshKey}</code>
            </div>
          )}
          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Prefix</th>
                  <th className="pb-2">Env</th>
                  <th className="pb-2">Last used</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={`border-b border-slate-100 last:border-0 ${k.revokedAt ? 'opacity-50' : ''}`}>
                    <td className="py-2.5">{k.name}</td>
                    <td className="py-2.5 font-mono text-xs">{k.prefix}…</td>
                    <td className="py-2.5">
                      <Badge tone={k.environment === 'live' ? 'red' : 'blue'}>{k.environment}</Badge>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                    </td>
                    <td className="py-2.5 text-right">
                      {!k.revokedAt && (
                        <button onClick={() => void revoke(k.id)} className="cursor-pointer text-xs text-red-500 hover:underline">
                          Revoke
                        </button>
                      )}
                      {k.revokedAt && <span className="text-xs text-slate-400">revoked</span>}
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
