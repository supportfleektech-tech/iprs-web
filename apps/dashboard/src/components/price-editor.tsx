'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Badge } from '@fleek/ui';
import { ProductPricingTier } from '@/lib/admin';
import { formatPriceMinor, tierRangeLabel, validatePriceInput, validateMinorInput } from '@/lib/admin';

export interface PriceEditorProps {
  tiers: ProductPricingTier[];
  pricing: { id: string; type: string; priceMinor: string | number | bigint; active: boolean }[];
  onSavePricing: (type: string, priceKes: number) => Promise<void>;
  onUpdateTier: (id: string, dto: { unitPriceMinor?: number; backupPriceMinor?: number | null }) => Promise<void>;
  onCreateTier?: (dto: { productType: string; minVolume: number; maxVolume: number | null; unitPriceMinor: number; backupPriceMinor?: number | null }) => Promise<void>;
}

/**
 * PriceEditor — global tier editor + simple pricing controls.
 * Per spec: explicit save/validation states, retryable errors, 44px targets,
 * semantic labels, reduced-motion, no PII.
 */
export function PriceEditor({ tiers, pricing, onSavePricing, onUpdateTier }: PriceEditorProps) {
  const [simpleEdits, setSimpleEdits] = useState<Record<string, string>>({});
  const [simpleSaving, setSimpleSaving] = useState<string | null>(null);
  const [simpleMsg, setSimpleMsg] = useState<Record<string, string>>({});
  const [simpleErr, setSimpleErr] = useState<Record<string, string>>({});

  const [tierEdits, setTierEdits] = useState<Record<string, { unitPrice: string; backupPrice: string }>>({});
  const [tierSaving, setTierSaving] = useState<string | null>(null);
  const [tierMsg, setTierMsg] = useState<Record<string, string>>({});
  const [tierErr, setTierErr] = useState<Record<string, string>>({});

  // Group tiers by productType for display
  const tiersByProduct = (() => {
    const m = new Map<string, ProductPricingTier[]>();
    for (const t of tiers) {
      const arr = m.get(t.productType) ?? [];
      arr.push(t);
      m.set(t.productType, arr);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => a.minVolume - b.minVolume);
      m.set(k, arr);
    }
    return m;
  })();

  async function handleSimpleSave(type: string) {
    const raw = simpleEdits[type];
    const err = validatePriceInput(raw ?? '');
    if (err) {
      setSimpleErr((s) => ({ ...s, [type]: err }));
      return;
    }
    setSimpleErr((s) => ({ ...s, [type]: '' }));
    setSimpleSaving(type);
    setSimpleMsg((s) => ({ ...s, [type]: '' }));
    try {
      await onSavePricing(type, Number(raw));
      setSimpleMsg((s) => ({ ...s, [type]: 'Saved — pricing updated' }));
      setSimpleEdits((s) => ({ ...s, [type]: '' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setSimpleErr((s) => ({ ...s, [type]: `${msg} — retry` }));
    } finally {
      setSimpleSaving(null);
    }
  }

  async function handleTierSave(tier: ProductPricingTier) {
    const edit = tierEdits[tier.id] ?? { unitPrice: String(tier.unitPriceMinor), backupPrice: tier.backupPriceMinor != null ? String(tier.backupPriceMinor) : '' };
    const unitStr = edit.unitPrice;
    const backupStr = edit.backupPrice;
    const unitErr = validateMinorInput(unitStr ?? '');
    if (unitErr) {
      setTierErr((s) => ({ ...s, [tier.id]: unitErr }));
      return;
    }
    if (backupStr.trim() !== '') {
      const bErr = validateMinorInput(backupStr);
      if (bErr) {
        setTierErr((s) => ({ ...s, [tier.id]: bErr }));
        return;
      }
    }
    setTierErr((s) => ({ ...s, [tier.id]: '' }));
    setTierSaving(tier.id);
    setTierMsg((s) => ({ ...s, [tier.id]: '' }));
    try {
      const unit = Number(unitStr);
      const backup = backupStr.trim() === '' ? null : Number(backupStr);
      await onUpdateTier(tier.id, { unitPriceMinor: unit, backupPriceMinor: backup });
      setTierMsg((s) => ({ ...s, [tier.id]: 'Saved' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setTierErr((s) => ({ ...s, [tier.id]: `${msg} — retry` }));
    } finally {
      setTierSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Simple per-product fallback pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Global product pricing</span>
            <Badge tone="slate">{pricing.length} products</Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">
            VAT-exclusive tier prices are source of truth — this panel also supports a simple per-product price for legacy checks. Backup rates apply only on explicit user toggle after upstream failure.
          </p>
        </CardHeader>
        <CardContent>
          {pricing.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No pricing records. Tiers below control live pricing.</p>
          ) : (
            <ul className="space-y-3" aria-label="Global product pricing">
              {pricing.map((p) => {
                const priceLabel = formatPriceMinor(p.priceMinor);
                return (
                  <li key={p.type} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1 text-sm font-medium text-navy-900">{p.type}</span>
                      <span className="text-xs text-slate-500">{priceLabel}</span>
                      <Badge tone={p.active ? 'green' : 'red'}>{p.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-36">
                        <Label htmlFor={`price-${p.type}`}>New price (KES)</Label>
                        <Input
                          id={`price-${p.type}`}
                          type="number"
                          min={1}
                          step={1}
                          placeholder={String(Number(p.priceMinor ?? 0) / 100)}
                          value={simpleEdits[p.type] ?? ''}
                          onChange={(e) => setSimpleEdits((v) => ({ ...v, [p.type]: e.target.value }))}
                          aria-describedby={simpleErr[p.type] ? `err-price-${p.type}` : undefined}
                          className="h-11"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleSimpleSave(p.type)}
                        disabled={tierSaving !== null || simpleSaving === p.type}
                        aria-label={`Save pricing for ${p.type}`}
                        className="h-11"
                      >
                        {simpleSaving === p.type ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {simpleErr[p.type] && (
                      <p id={`err-price-${p.type}`} role="alert" className="mt-2 flex items-center gap-2 text-xs text-red-600">
                        <span>{simpleErr[p.type]}</span>
                        <button
                          type="button"
                          onClick={() => void handleSimpleSave(p.type)}
                          className="inline-flex h-7 items-center rounded-lg border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                        >
                          Retry
                        </button>
                      </p>
                    )}
                    {simpleMsg[p.type] && <p role="status" aria-live="polite" className="mt-2 text-xs text-teal-700">{simpleMsg[p.type]}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tier editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Global tier editor</span>
            <Badge tone="blue">{tiers.length} tiers</Badge>
          </CardTitle>
          <p className="text-xs text-slate-500">
            Volume bands 0–500 · 501–2500 · 2501–5000 · 5001–10k · 10k–30k · 30k+ (SPIN Score uses its own bands). Prices are in minor units (KES ×100), VAT-exclusive. Backup price applies only on explicit user toggle.
          </p>
        </CardHeader>
        <CardContent>
          {tiers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No tiers configured. Create tiers per product type in the API.</p>
          ) : (
            <div className="space-y-6">
              {Array.from(tiersByProduct.entries()).map(([productType, productTiers]) => (
                <div key={productType} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50/60 px-4 py-3 flex items-center justify-between border-b border-slate-200">
                    <span className="text-sm font-semibold text-navy-900">{productType}</span>
                    <Badge tone="slate">{productTiers.length} bands</Badge>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {productTiers.map((tier) => {
                      const edit = tierEdits[tier.id] ?? { unitPrice: String(tier.unitPriceMinor), backupPrice: tier.backupPriceMinor != null ? String(tier.backupPriceMinor) : '' };
                      const range = tierRangeLabel(tier.minVolume, tier.maxVolume);
                      return (
                        <li key={tier.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Volume {range} · {tier.vatExclusive ? 'VAT exclusive' : 'VAT inclusive'}
                            </span>
                            <span className="text-xs text-slate-400">
                              Current {formatPriceMinor(tier.unitPriceMinor)}{tier.backupPriceMinor != null ? ` · backup ${formatPriceMinor(tier.backupPriceMinor)}` : ''}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                            <div>
                              <Label htmlFor={`tier-unit-${tier.id}`}>Unit price (minor)</Label>
                              <Input
                                id={`tier-unit-${tier.id}`}
                                type="number"
                                min={100}
                                step={100}
                                value={edit.unitPrice}
                                onChange={(e) => setTierEdits((v) => ({ ...v, [tier.id]: { unitPrice: e.target.value, backupPrice: v[tier.id]?.backupPrice ?? tier.backupPriceMinor != null ? String(tier.backupPriceMinor) : '' } }))}
                                aria-describedby={tierErr[tier.id] ? `err-tier-${tier.id}` : undefined}
                                className="h-11"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`tier-backup-${tier.id}`}>Backup price (minor, optional)</Label>
                              <Input
                                id={`tier-backup-${tier.id}`}
                                type="number"
                                min={100}
                                step={100}
                                placeholder="—"
                                value={edit.backupPrice}
                                onChange={(e) => setTierEdits((v) => ({ ...v, [tier.id]: { unitPrice: v[tier.id]?.unitPrice ?? String(tier.unitPriceMinor), backupPrice: e.target.value } }))}
                                className="h-11"
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => void handleTierSave(tier)}
                              disabled={tierSaving === tier.id}
                              aria-label={`Save tier ${range} for ${productType}`}
                              className="h-11"
                            >
                              {tierSaving === tier.id ? 'Saving…' : 'Save'}
                            </Button>
                          </div>
                          {tierErr[tier.id] && (
                            <p id={`err-tier-${tier.id}`} role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-600">
                              <span>{tierErr[tier.id]}</span>
                              <button
                                type="button"
                                onClick={() => void handleTierSave(tier)}
                                className="inline-flex h-7 items-center rounded-lg border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                              >
                                Retry
                              </button>
                            </p>
                          )}
                          {tierMsg[tier.id] && <p role="status" aria-live="polite" className="mt-2 text-xs text-teal-700">{tierMsg[tier.id]}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
