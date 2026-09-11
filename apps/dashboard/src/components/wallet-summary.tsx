'use client';

import { Card, Badge } from '@fleek/ui';
import { DashboardIcon } from './dashboard-icons';
import {
  formatWalletBalance,
  formatLedgerAmount,
  formatTimestamp,
  summarizeWalletActivity,
  type WalletTransaction,
  type WalletTopUp,
} from '@/lib/wallet';

export interface WalletHeroProps {
  balance: number | null;
  currency?: string;
  loading?: boolean;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exporting?: string | null;
}

export function WalletHero({
  balance,
  currency = 'KES',
  loading = false,
  onExportCsv,
  onExportPdf,
  exporting,
}: WalletHeroProps) {
  return (
    <section
      aria-label="Wallet balance"
      className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]"
    >
      <Card className="overflow-hidden border-navy-900 bg-navy-900 p-0 text-white">
        <div className="p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">
                Available balance
              </p>
              {loading ? (
                <div
                  className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <p
                  className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl"
                  aria-live="polite"
                >
                  {formatWalletBalance(balance)}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-300">
                Currency <span className="font-medium text-white">{currency}</span> · Audited
                ledger, encrypted at rest
              </p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-400/25"
              aria-hidden="true"
            >
              <DashboardIcon name="wallet" className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/10">
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" /> Live ledger
            </span>
            <span className="hidden sm:inline text-slate-400">·</span>
            <span className="text-slate-300">Top up via any rail below — M-Pesa is instant.</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/5 px-6 py-3">
          <span className="text-xs font-medium text-slate-300">Export statement</span>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!!exporting}
            aria-label="Export wallet statement as CSV"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50 motion-reduce:transition-none"
          >
            <DashboardIcon name="download" className="h-3.5 w-3.5" aria-hidden="true" />
            {exporting === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={!!exporting}
            aria-label="Export wallet statement as PDF"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-navy-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50 motion-reduce:transition-none"
          >
            <DashboardIcon name="file" className="h-3.5 w-3.5" aria-hidden="true" />
            {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100"
            aria-hidden="true"
          >
            <DashboardIcon name="info" className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-navy-900">How topping up works</h2>
        </div>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
          <li className="flex gap-2">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500"
              aria-hidden="true"
            />
            <span>
              M-Pesa, card, and PayPal credit instantly in sandbox (auto-complete ~3s). Live rails
              show sandbox/live messaging.
            </span>
          </li>
          <li className="flex gap-2">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
              aria-hidden="true"
            />
            <span>
              Bank/Paybill needs your M-Pesa confirmation reference — wallet is credited on
              confirmation.
            </span>
          </li>
          <li className="flex gap-2">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
              aria-hidden="true"
            />
            <span>Invoices are credited after admin approval. All amounts are in KES.</span>
          </li>
        </ul>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
          Need help? Wallet movements appear in the ledger below with running balance.
        </p>
      </Card>
    </section>
  );
}

export interface WalletActivityProps {
  transactions: WalletTransaction[];
  topUps: WalletTopUp[];
  loading?: boolean;
}

export function WalletActivitySummary({ transactions, topUps, loading }: WalletActivityProps) {
  if (loading) {
    return (
      <section aria-label="Wallet activity" className="grid gap-4 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-white ring-1 ring-slate-200 motion-reduce:animate-none"
            aria-hidden="true"
          />
        ))}
      </section>
    );
  }

  const { txCount, topUpCount, pendingTopUps, lastMovementAt } = summarizeWalletActivity(
    transactions,
    topUps,
  );
  const recentCredit = transactions.find((t) => t.type === 'topup');
  const recentDebit = transactions.find((t) => t.type !== 'topup');

  return (
    <section aria-label="Wallet activity" className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ledger entries</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{txCount}</p>
        <p className="mt-1 text-xs text-slate-400">
          {recentCredit ? `Last credit ${formatLedgerAmount(recentCredit)}` : 'No credits yet'}
          {recentDebit ? ` · last debit ${formatLedgerAmount(recentDebit)}` : ''}
        </p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Top-up requests
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{topUpCount}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{pendingTopUps > 0 ? `${pendingTopUps} pending` : 'No pending requests'}</span>
          {pendingTopUps > 0 && <Badge tone="amber">{String(pendingTopUps)} pending</Badge>}
        </p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last movement</p>
        <p className="mt-1 text-sm font-medium text-navy-900">
          {lastMovementAt ? formatTimestamp(lastMovementAt) : '—'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {lastMovementAt ? 'Most recent ledger or top-up time' : 'No activity yet'}
        </p>
      </Card>
    </section>
  );
}

export interface WalletSummaryProps extends WalletHeroProps, WalletActivityProps {}

export function WalletSummary(props: WalletSummaryProps) {
  return (
    <div className="space-y-4">
      <WalletHero
        balance={props.balance}
        currency={props.currency}
        loading={props.loading}
        onExportCsv={props.onExportCsv}
        onExportPdf={props.onExportPdf}
        exporting={props.exporting}
      />
      <WalletActivitySummary
        transactions={props.transactions}
        topUps={props.topUps}
        loading={props.loading}
      />
    </div>
  );
}
