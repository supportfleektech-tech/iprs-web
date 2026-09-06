'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { VERIFICATION_TYPES } from '@fleek/types';

interface TopUp {
  id: string;
  organizationId: string;
  amountMinor: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
  organization?: { name: string };
}

interface Pricing {
  id: string;
  type: string;
  priceMinor: string;
  active: boolean;
}

interface OrgPricingTier {
  id: string;
  productType: string;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number;
  backupPriceMinor: number | null;
  vatExclusive: boolean;
}

interface OrgEnabledCheck {
  productType: string;
  enabled: boolean;
}

interface Org {
  id: string;
  name: string;
  wallet?: { balanceMinor: string } | null;
  _count?: { users: number };
}

export default function AdminPage() {
  const { token, user } = useAuth();
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [enabledChecks, setEnabledChecks] = useState<OrgEnabledCheck[]>([]);
  const [pricingEdits, setPricingEdits] = useState<Record<string, string>>({});
  const [pricingMsg, setPricingMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [t, p] = await Promise.all([
      apiFetch<TopUp[]>('/admin/top-ups', { token }),
      apiFetch<Pricing[]>('/admin/pricing', { token }),
    ]);
    setTopUps(t);
    setPricing(p);
    try {
      setOrgs(await apiFetch<Org[]>('/admin/organizations', { token }));
    } catch {
      // org OWNER without platform scope — fine
    }
  }, [token]);

  useEffect(() => {
    if (user) void load().catch((e) => setMsg(e.message));
  }, [load, user]);

  async function review(id: string, approve: boolean) {
    await apiFetch(`/admin/top-ups/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
      token,
    });
    await load();
  }

  async function savePrice(type: string) {
    const value = priceEdits[type];
    if (!value) return;
    await apiFetch('/admin/pricing', {
      method: 'POST',
      body: JSON.stringify({ type, price: Number(value) }),
      token,
    });
    setMsg(`Pricing updated for ${type}`);
    await load();
  }

  async function loadOrgDetails(orgId: string) {
    const [enabled, pricing] = await Promise.all([
      apiFetch<OrgEnabledCheck[]>(`/admin/organizations/${orgId}/enabled-checks`, { token }),
      apiFetch<OrgPricingTier[]>(`/admin/organizations/${orgId}/pricing-tiers`, { token }),
    ]);
    setEnabledChecks(enabled);
    setPricingEdits(
      pricing.reduce((acc, tier) => {
        acc[tier.productType] = tier.unitPriceMinor.toString();
        return acc;
      }, {} as Record<string, string>)
    );
    setSelectedOrgId(orgId);
  }

  async function updateEnabledChecks(orgId: string, productType: string, enabled: boolean) {
    await apiFetch(`/admin/organizations/${orgId}/enabled-checks`, {
      method: 'PUT',
      body: JSON.stringify({ productType, enabled }),
      token,
    });
    await loadOrgDetails(orgId);
  }

  async function savePricing(type: string) {
    const value = pricingEdits[type];
    if (!value) return;
    await apiFetch('/admin/organizations/' + selectedOrgId + '/pricing-tiers', {
      method: 'POST',
      body: JSON.stringify({ type, unitPriceMinor: Number(value) }),
      token,
    });
    setPricingMsg(`Pricing updated for ${type}`);
    await loadOrgDetails(selectedOrgId!);
  }

  if (!user?.isPlatformAdmin && user?.role !== 'OWNER') {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Admin access required.
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Admin</h1>
      <p className="mb-6 text-sm text-slate-500">Approve credit requests and manage product pricing.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top-up requests</CardTitle>
          </CardHeader>
          <CardContent>
            {topUps.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nothing pending.</p>
            ) : (
              <ul className="space-y-3">
                {topUps.map((t) => (
                  <li key={t.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        KES {(Number(t.amountMinor) / 100).toLocaleString()}
                      </span>
                      <Badge tone={t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'amber'}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {t.organization?.name ?? t.organizationId} · {new Date(t.createdAt).toLocaleString()}
                    </div>
                    {t.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => void review(t.id, true)}>
                          Approve & credit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void review(t.id, false)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pricing.map((p) => (
                <li key={p.type} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <span className="w-40 truncate text-sm">{p.type}</span>
                  <Input
                    className="w-28"
                    type="number"
                    min={1}
                    step={10}
                    placeholder={String(Number(p.priceMinor) / 100)}
                    value={priceEdits[p.type] ?? ''}
                    onChange={(e) => setPriceEdits((v) => ({ ...v, [p.type]: e.target.value }))}
                  />
                  <Button size="sm" variant="secondary" onClick={() => void savePrice(p.type)}>
                    Save
                  </Button>
                </li>
              ))}
            </ul>
            {msg && <p className="mt-3 text-xs text-teal-brand">{msg}</p>}
          </CardContent>
        </Card>
      </div>

      {selectedOrgId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Organization: {selectedOrgId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <CardHeader>
                  <CardTitle>Enabled Verification Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">
                    Select which verification types are available for this organization:
                  </p>
                  <div className="space-y-2">
                    {VERIFICATION_TYPES.map((type) => {
                      const isEnabled = enabledChecks.some((check) => check.productType === type);
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <Input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => updateEnabledChecks(selectedOrgId!, type, e.target.checked)}
                            className="form-checkbox form-checkbox-success w-4 h-4"
                          />
                          <span className="text-sm font-medium">{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </div>

              <div>
                <CardHeader>
                  <CardTitle>Pricing Tiers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">
                    Set org-specific pricing (overrides global pricing):
                  </p>
                  <div className="space-y-3">
                    {VERIFICATION_TYPES.map((type) => {
                      const currentPrice = pricingEdits[type] ?? '';
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <span className="w-40 truncate text-sm">{type}</span>
                          <Input
                            type="number"
                            min={1}
                            step={10}
                            placeholder="0"
                            value={currentPrice}
                            onChange={(e) => setPricingEdits((v) => ({ ...v, [type]: e.target.value }))}
                            className="w-28"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void savePricing(type)}
                          >
                            Save
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {pricingMsg && <p className="mt-3 text-xs text-teal-brand">{pricingMsg}</p>}
                </CardContent>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {orgs.length > 0 && !selectedOrgId && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2 text-right">Users</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5">{o.name}</td>
                    <td className="py-2.5 text-right">{o._count?.users ?? '—'}</td>
                    <td className="py-2.5 text-right">
                      KES {(Number(o.wallet?.balanceMinor ?? 0) / 100).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void loadOrgDetails(o.id)}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}