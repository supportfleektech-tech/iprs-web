'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button } from '@fleek/ui';
import type { VerificationType } from '@fleek/types';
import { apiFetch, useAuth } from '@/lib/auth';
import { DashboardIcon } from '@/components/dashboard-icons';
import { EmptyState } from '@/components/empty-state';
import { LoadingState } from '@/components/loading-state';
import { StatusBadge } from '@/components/status-badge';
import { VerificationForm } from '@/components/verification-form';
import { ResultPanel } from '@/components/result-panel';
import {
  formatCurrency,
  getVerificationLabel,
  groupProductsByCategory,
  type ProductOption,
  type VerificationResultPayload,
} from '@/lib/verification-form';

export function VerifyWorkspace() {
  const { token } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedType, setSelectedType] = useState<VerificationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResultPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [backupPending, setBackupPending] = useState(false);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<ProductOption[]>('/verifications/products', { token });
      setProducts(list);
      setSelectedType((prev) => {
        if (prev) return prev;
        if (list.length) {
          const firstAvailable = list.find((p) => p.enabled && p.active);
          return (firstAvailable ?? list[0])!.type as VerificationType;
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.type === selectedType) ?? null,
    [products, selectedType],
  );

  const grouped = useMemo(() => groupProductsByCategory(products), [products]);

  const handleResult = useCallback((detail: VerificationResultPayload) => {
    setResult(detail);
    setFormError(null);
  }, []);

  const handleBackupRetry = useCallback(async () => {
    if (!token || !lastPayload) {
      setFormError(
        'Original request details are no longer available. Please refill the form and submit again.',
      );
      return;
    }
    setBackupPending(true);
    setFormError(null);
    try {
      const payload = { ...lastPayload, useBackup: true };
      const run = await apiFetch<{ id: string }>('/verifications', {
        method: 'POST',
        body: JSON.stringify(payload),
        token,
      });
      const detail = await apiFetch<VerificationResultPayload>(`/verifications/${run.id}`, {
        token,
      });
      setResult(detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backup verification failed';
      setFormError(msg);
    } finally {
      setBackupPending(false);
    }
  }, [token, lastPayload]);

  if (loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading verification workspace" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-5"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex flex-wrap items-start gap-3">
          <DashboardIcon
            name="alert"
            className="h-5 w-5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-red-700">
              Verification workspace could not be loaded
            </h2>
            <p className="mt-1 break-words text-sm text-red-700/80">{error}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void fetchProducts()}
            className="h-11 shrink-0"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No verification products available"
        description="Product availability could not be loaded. Please refresh the workspace or contact support."
        action={{ label: 'Retry', onClick: () => void fetchProducts() }}
      />
    );
  }

  if (!selectedProduct) {
    return (
      <EmptyState
        title="No product selected"
        description="Choose a verification product to begin."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            Verification workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 md:text-3xl">
            Run a verification
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Choose a product, provide the required evidence, and review the structured result.
            Backup pricing is shown only when the primary provider is unavailable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />{' '}
            {products.filter((p) => p.enabled && p.active).length} of {products.length} available
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        {/* Product catalog */}
        <section
          aria-labelledby="product-catalog-title"
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="product-catalog-title" className="text-sm font-semibold text-navy-900">
              Product catalog
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {products.filter((p) => p.enabled && p.active).length} available · {products.length}{' '}
              total · grouped by category
            </p>
          </div>
          <div className="max-h-[640px] overflow-y-auto px-3 py-4">
            {Array.from(grouped.entries()).map(([category, categoryProducts]) => (
              <div key={category} className="mb-5 last:mb-0">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.09em] text-slate-500">
                    {category}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400">
                    {categoryProducts.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {categoryProducts.map((product) => {
                    const available = product.enabled && product.active;
                    const isSelected = selectedType === product.type;
                    return (
                      <button
                        key={product.type}
                        type="button"
                        onClick={() => {
                          setSelectedType(product.type as VerificationType);
                          setResult(null);
                          setFormError(null);
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${product.label}, ${available ? 'available' : 'unavailable'}${product.cbConsentRequired ? ', CB consent required' : ''}${product.requiresFileUpload ? ', file upload required' : ''}${product.backupAvailable ? ', backup available' : ''}`}
                        className={`flex w-full flex-col gap-1.5 rounded-xl border px-3 py-3 text-left transition-[border-color,background-color,transform,opacity] duration-200 motion-reduce:transition-none ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/20'
                            : available
                              ? 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'
                              : 'border-slate-100 bg-slate-50/60 opacity-70'
                        }`}
                      >
                        <span
                          className={`text-sm font-medium leading-tight ${isSelected ? 'text-navy-900' : 'text-slate-700'}`}
                        >
                          {product.label}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {available ? (
                            <Badge tone="green">Active</Badge>
                          ) : (
                            <Badge tone="slate">Inactive</Badge>
                          )}
                          {product.cbConsentRequired && <Badge tone="amber">CB consent</Badge>}
                          {product.requiresFileUpload && <Badge tone="blue">File</Badge>}
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span
                            className={available ? 'font-medium text-slate-600' : 'text-slate-400'}
                          >
                            {available && product.unitPriceKes != null
                              ? formatCurrency(product.unitPriceKes)
                              : 'Unavailable'}
                          </span>
                          {product.backupAvailable && product.backupPriceKes != null && (
                            <span className="text-slate-400">
                              backup {formatCurrency(product.backupPriceKes)}
                            </span>
                          )}
                          {!product.backupAvailable && (
                            <span className="text-slate-300">no backup</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Focused form + result */}
        <section aria-labelledby="verification-form-title" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                New verification
              </p>
              <h2
                id="verification-form-title"
                className="mt-1 text-xl font-semibold tracking-tight text-navy-900"
              >
                {getVerificationLabel(selectedProduct.type as VerificationType)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Provide the minimum evidence required for this check.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedProduct.active && selectedProduct.enabled ? (
                <StatusBadge status="active" label="Available" />
              ) : (
                <StatusBadge status="inactive" label="Unavailable" />
              )}
              {selectedProduct.vatExclusive && <StatusBadge status="slate" label="VAT exclusive" />}
              {selectedProduct.requiresFileUpload && (
                <StatusBadge status="blue" label="File required" />
              )}
              {selectedProduct.live ? (
                <Badge tone="blue">Live</Badge>
              ) : (
                <Badge tone="slate">Sandbox</Badge>
              )}
            </div>
          </div>

          <VerificationForm
            product={selectedProduct}
            token={token}
            onResult={handleResult}
            onPayload={setLastPayload}
            onError={setFormError}
          />

          {formError && !result && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex gap-3">
                <DashboardIcon
                  name="alert"
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">Verification failed</p>
                  <p className="mt-1 break-words text-sm text-red-700/80">{formError}</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <ResultPanel
              detail={result}
              onRetryBackup={result.backupAvailable ? handleBackupRetry : undefined}
              backupPending={backupPending}
            />
          )}
        </section>
      </div>
    </div>
  );
}
