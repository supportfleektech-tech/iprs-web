'use client';

import Link from 'next/link';
import { DashboardIcon } from './dashboard-icons';
import { StatusBadge } from './status-badge';
import {
  formatCurrency,
  formatResultValue,
  humanise,
  isSensitiveResultKey,
} from '@/lib/verification-form';
import type { VerificationResultPayload } from '@/lib/verification-form';

export interface ResultPanelProps {
  detail: VerificationResultPayload;
  onRetryBackup?: () => void;
  backupPending?: boolean;
}

export function ResultPanel({ detail, onRetryBackup, backupPending }: ResultPanelProps) {
  const entries = detail.result
    ? Object.entries(detail.result).filter(([key]) => !isSensitiveResultKey(key))
    : [];

  const showBackupBanner = Boolean(
    detail.backupAvailable &&
    detail.backupPrice != null &&
    (detail.status === 'failed' || !!detail.errorMessage),
  );

  return (
    <section
      className="dashboard-reveal rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="verification-result-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Verification result
          </p>
          <h2 id="verification-result-title" className="mt-1 text-lg font-semibold text-navy-900">
            {humanise(detail.type)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={detail.status} />
          {detail.isBackup && <StatusBadge status="backup" label="Backup run" />}
        </div>
      </div>

      {/* Structured evidence metrics */}
      <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Cost" value={detail.cost > 0 ? formatCurrency(detail.cost) : 'Free'} />
        <Metric
          label="Latency"
          value={detail.latencyMs != null ? `${detail.latencyMs.toLocaleString()} ms` : '—'}
        />
        <Metric label="Source" value={detail.source ?? 'dashboard'} />
        <Metric label="Recorded" value={new Date(detail.createdAt).toLocaleString()} />
      </div>

      <div className="px-5 py-4">
        {detail.errorMessage ? (
          <div
            className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
            role="alert"
            aria-live="assertive"
          >
            <DashboardIcon
              name="alert"
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700">Verification could not complete</p>
              <p className="mt-1 break-words text-sm text-red-700/80">{detail.errorMessage}</p>
            </div>
          </div>
        ) : null}

        {showBackupBanner && (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
            role="alert"
            aria-live="polite"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">Backup provider available</p>
              <p className="mt-1 text-sm text-amber-700/90">
                The primary provider is unavailable. Backup pricing is{' '}
                {formatCurrency(detail.backupPrice ?? 0)} and is charged only after you confirm.
              </p>
            </div>
            {onRetryBackup ? (
              <button
                type="button"
                onClick={onRetryBackup}
                disabled={backupPending}
                aria-busy={backupPending}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition-[transform,opacity,background-color] duration-200 hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              >
                <DashboardIcon
                  name="refresh"
                  className={`h-4 w-4 ${backupPending ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {backupPending ? 'Retrying…' : 'Retry with backup'}
              </button>
            ) : (
              <span className="text-xs text-amber-700">Retrying with backup…</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No result payload was returned for this check.</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="min-w-0 rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {humanise(key)}
                </dt>
                <dd className="mt-1 break-words text-sm text-navy-900">
                  {typeof value === 'object' && value !== null ? (
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {formatResultValue(value)}
                    </pre>
                  ) : (
                    formatResultValue(value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-500">
          Record ID{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
            {detail.id.slice(0, 12)}…
          </code>{' '}
          {detail.isBackup && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">backup</span>
          )}
        </p>
        <Link
          href={`/console/history/${detail.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-navy-900 transition-[border-color,color,transform,opacity] duration-200 hover:border-teal-500 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none"
        >
          <DashboardIcon name="external" className="h-4 w-4" aria-hidden="true" />
          Open evidence record
        </Link>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium tabular-nums text-navy-900">{value}</p>
    </div>
  );
}
