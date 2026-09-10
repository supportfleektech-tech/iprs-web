'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from '@fleek/ui';
import { VERIFICATION_TYPES } from '@fleek/types';
import { AdminTable } from './admin-table';
import { formatPriceMinor, validateMinorInput } from '@/lib/admin';
import { apiFetch } from '@/lib/auth';

export interface OrgPricingTier {
  id: string;
  productType: string;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number;
  backupPriceMinor: number | null;
  vatExclusive: boolean;
}

export interface OrgEnabledCheck {
  productType: string;
  enabled: boolean;
}

export interface OrgSummary {
  id: string;
  name: string;
  wallet?: { balanceMinor: string | bigint } | null;
  _count?: { users: number };
}

export interface OrgManagementProps {
  organizations: OrgSummary[];
  token: string | null;
  onReloadOrgs?: () => Promise<void>;
}

/**
 * OrgManagement — organization table + per-org pricing/availability controls.
 * Accepts organizations and save callbacks per brief; internally fetches per-org
 * enabled-checks and pricing tiers when an org is selected.
 * Explicit validation, retryable errors, 44px targets, semantic labels.
 */
export function OrgManagement({ organizations, token, onReloadOrgs }: OrgManagementProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string | null>(null);

  const [enabledChecks, setEnabledChecks] = useState<OrgEnabledCheck[]>([]);
  const [checkEdits, setCheckEdits] = useState<Record<string, boolean>>({});
  const [checksMsg, setChecksMsg] = useState<string | null>(null);
  const [checksErr, setChecksErr] = useState<string | null>(null);
  const [checksBusy, setChecksBusy] = useState(false);

  // Store fetched tiers for normalization; value used via pricingEds/Ids derived above.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_pricingTiers, setPricingTiers] = useState<OrgPricingTier[]>([]);
  const [pricingEdits, setPricingEdits] = useState<Record<string, string>>({});
  const [pricingIds, setPricingIds] = useState<Record<string, string>>({});
  const [pricingMsg, setPricingMsg] = useState<Record<string, string>>({});
  const [pricingErr, setPricingErr] = useState<Record<string, string>>({});
  const [pricingBusyTier, setPricingBusyTier] = useState<string | null>(null);

  const [orgLoading, setOrgLoading] = useState(false);
  const [orgErr, setOrgErr] = useState<string | null>(null);

  async function loadOrgDetails(orgId: string) {
    setOrgLoading(true);
    setOrgErr(null);
    setChecksMsg(null);
    setChecksErr(null);
    try {
      const [enabled, tiers] = await Promise.all([
        apiFetch<OrgEnabledCheck[]>(`/admin/organizations/${orgId}/enabled-checks`, { token }),
        apiFetch<OrgPricingTier[]>(`/admin/organizations/${orgId}/pricing-tiers`, { token }),
      ]);
      setEnabledChecks(enabled);
      const byType = new Map(enabled.map((c) => [c.productType, c.enabled]));
      setCheckEdits(Object.fromEntries(VERIFICATION_TYPES.map((t) => [t, byType.get(t) ?? true])));
      const edits: Record<string, string> = {};
      const ids: Record<string, string> = {};
      for (const tier of tiers) {
        edits[tier.productType] = String(tier.unitPriceMinor);
        ids[tier.productType] = tier.id;
      }
      setPricingEdits(edits);
      setPricingIds(ids);
      setPricingTiers(tiers);
      setSelectedOrgId(orgId);
      setSelectedOrgName(organizations.find((o) => o.id === orgId)?.name ?? orgId);
    } catch (e) {
      setOrgErr(e instanceof Error ? e.message : 'Failed to load organization');
    } finally {
      setOrgLoading(false);
    }
  }

  async function saveEnabledChecks() {
    if (!selectedOrgId) return;
    setChecksBusy(true);
    setChecksMsg(null);
    setChecksErr(null);
    try {
      const byType = new Map(enabledChecks.map((c) => [c.productType, c.enabled]));
      for (const [productType, enabled] of Object.entries(checkEdits)) {
        if (byType.get(productType) === enabled) continue;
        await apiFetch(`/admin/organizations/${selectedOrgId}/enabled-checks`, {
          method: 'PUT',
          body: JSON.stringify({ productType, enabled }),
          token,
        });
      }
      setChecksMsg('Availability saved — the organization dashboard reflects this immediately.');
      await loadOrgDetails(selectedOrgId);
    } catch (e) {
      setChecksErr(e instanceof Error ? `${e.message} — retry` : 'Failed to save — retry');
    } finally {
      setChecksBusy(false);
    }
  }

  async function savePricing(type: string) {
    const value = pricingEdits[type];
    const err = validateMinorInput(value ?? '');
    if (err) {
      setPricingErr((s) => ({ ...s, [type]: err }));
      return;
    }
    setPricingErr((s) => ({ ...s, [type]: '' }));
    setPricingMsg((s) => ({ ...s, [type]: '' }));
    setPricingBusyTier(type);
    try {
      const existingId = pricingIds[type];
      if (existingId && selectedOrgId) {
        await apiFetch(`/admin/organizations/${selectedOrgId}/pricing-tiers/${existingId}`, {
          method: 'PUT',
          body: JSON.stringify({ unitPriceMinor: Number(value) }),
          token,
        });
      } else if (selectedOrgId) {
        await apiFetch(`/admin/organizations/${selectedOrgId}/pricing-tiers`, {
          method: 'POST',
          body: JSON.stringify({ productType: type, minVolume: 0, maxVolume: null, unitPriceMinor: Number(value) }),
          token,
        });
      }
      setPricingMsg((s) => ({ ...s, [type]: 'Saved' }));
      if (selectedOrgId) await loadOrgDetails(selectedOrgId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setPricingErr((s) => ({ ...s, [type]: `${msg} — retry` }));
    } finally {
      setPricingBusyTier(null);
    }
  }

  // Reset selection if orgs change and selected no longer exists
  useEffect(() => {
    if (selectedOrgId && !organizations.some((o) => o.id === selectedOrgId)) {
      setSelectedOrgId(null);
      setSelectedOrgName(null);
    }
  }, [organizations, selectedOrgId]);

  return (
    <div className="space-y-6">
      {/* Organization table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Organizations</span>
            <Badge tone="slate">{organizations.length}</Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">Balance is ledger-verified, KES. Manage to edit pricing and availability per organization. Vault-grade controls.</p>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No organizations found.</p>
          ) : (
            <AdminTable
              ariaLabel="Organizations"
              caption="Organization balances and user counts"
              columns={[
                {
                  key: 'name',
                  header: 'Organization',
                  render: (o: OrgSummary) => <span className="font-medium text-navy-900">{o.name}</span>,
                },
                {
                  key: 'users',
                  header: 'Users',
                  align: 'right',
                  accessor: (o: OrgSummary) => String(o._count?.users ?? '—'),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  align: 'right',
                  render: (o: OrgSummary) => (
                    <span className="tabular-nums font-medium">
                      {o.wallet?.balanceMinor != null ? formatPriceMinor(o.wallet.balanceMinor) : 'KES —'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Manage',
                  align: 'right',
                  render: (o: OrgSummary) => (
                    <Button
                      size="sm"
                      variant={selectedOrgId === o.id ? 'primary' : 'secondary'}
                      onClick={() => void loadOrgDetails(o.id)}
                      aria-label={`Manage ${o.name}`}
                      className="h-11"
                    >
                      {selectedOrgId === o.id ? 'Selected' : 'Manage'}
                    </Button>
                  ),
                },
              ]}
              rows={organizations}
              getRowKey={(o) => o.id}
            />
          )}
          {selectedOrgId && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Selected: <span className="font-medium text-navy-900">{selectedOrgName ?? selectedOrgId}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrgId(null);
                  setSelectedOrgName(null);
                }}
                className="text-xs text-slate-500 underline hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
              >
                Clear
              </button>
              {onReloadOrgs && (
                <button
                  type="button"
                  onClick={() => void onReloadOrgs()}
                  className="ml-auto inline-flex h-7 items-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                >
                  Reload orgs
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-org controls when selected */}
      {selectedOrgId && (
        <Card>
          <CardHeader>
            <CardTitle>Organization: {selectedOrgName ?? selectedOrgId}</CardTitle>
            {orgLoading && <p className="text-xs text-slate-500">Loading availability and pricing…</p>}
            {orgErr && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
                <span>{orgErr}</span>
                <button
                  type="button"
                  onClick={() => void loadOrgDetails(selectedOrgId)}
                  className="inline-flex h-7 items-center rounded-lg border border-red-200 bg-white px-2 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                >
                  Retry
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enabled checks */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50/60 px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-navy-900">Enabled checks</h3>
                <p className="text-xs text-slate-500 mt-1">Tick the lookups this organization may use. No row = enabled (global default). Change applies immediately.</p>
              </div>
              <div className="p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {VERIFICATION_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 hover:bg-slate-50 transition-colors motion-reduce:transition-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkEdits[type] ?? true}
                        onChange={(e) => setCheckEdits((v) => ({ ...v, [type]: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-cyan-600"
                        aria-label={`${type} enabled`}
                      />
                      <span className="text-sm text-slate-700 min-w-0 truncate">{type}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button size="sm" disabled={checksBusy || orgLoading} onClick={() => void saveEnabledChecks()} className="h-11" aria-label="Save enabled checks">
                    {checksBusy ? 'Saving…' : 'Save availability'}
                  </Button>
                  {checksMsg && <span role="status" aria-live="polite" className="text-xs text-teal-700">{checksMsg}</span>}
                </div>
                {checksErr && (
                  <p role="alert" className="mt-2 flex items-center gap-2 text-xs text-red-600">
                    <span>{checksErr}</span>
                    <button
                      type="button"
                      onClick={() => void saveEnabledChecks()}
                      className="inline-flex h-7 items-center rounded-lg border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>
            </div>

            {/* Org pricing tiers */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50/60 px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-navy-900">Organization pricing overrides</h3>
                <p className="text-xs text-slate-500 mt-1">Org-specific unit price (minor units) overrides global tiers. Leave empty to inherit global pricing.</p>
              </div>
              <div className="p-4 space-y-3">
                {VERIFICATION_TYPES.map((type) => {
                  const current = pricingEdits[type] ?? '';
                  const hasOverride = pricingIds[type] != null;
                  return (
                    <div key={type} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 p-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-navy-900 truncate block">{type}</span>
                        <span className="text-xs text-slate-500">{hasOverride ? `Override ${formatPriceMinor(current)}` : 'Using global price'}</span>
                      </div>
                      <div className="w-36">
                        <Input
                          type="number"
                          min={100}
                          step={100}
                          placeholder="minor (e.g. 3000)"
                          value={current}
                          onChange={(e) => setPricingEdits((v) => ({ ...v, [type]: e.target.value }))}
                          aria-label={`Price for ${type}`}
                          aria-describedby={pricingErr[type] ? `err-org-${type}` : undefined}
                          className="h-11 w-36"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void savePricing(type)}
                        disabled={pricingBusyTier === type}
                        aria-label={`Save pricing for ${type}`}
                        className="h-11"
                      >
                        {pricingBusyTier === type ? 'Saving…' : 'Save'}
                      </Button>
                      <div className="w-full">
                        {pricingErr[type] && (
                          <p id={`err-org-${type}`} role="alert" className="flex items-center gap-2 text-xs text-red-600">
                            <span>{pricingErr[type]}</span>
                            <button
                              type="button"
                              onClick={() => void savePricing(type)}
                              className="inline-flex h-7 items-center rounded-lg border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                            >
                              Retry
                            </button>
                          </p>
                        )}
                        {pricingMsg[type] && <p role="status" aria-live="polite" className="text-xs text-teal-700">{pricingMsg[type]}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
