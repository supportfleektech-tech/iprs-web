'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fleek/ui';
import { DashboardIcon } from './dashboard-icons';
import { PAYMENT_RAIL_LABELS, PAYMENT_RAIL_DESCRIPTIONS, type PaymentRailType } from '@/lib/wallet';

export type { PaymentRailType };
export type { PaymentRailProps } from '@/lib/wallet';

export const RAIL_TABS: Array<{ rail: PaymentRailType }> = [
  { rail: 'mpesa' },
  { rail: 'bank' },
  { rail: 'card' },
  { rail: 'paypal' },
  { rail: 'invoice' },
];

export interface PaymentRailTabsProps {
  activeRail: PaymentRailType;
  onChange: (rail: PaymentRailType) => void;
  canManage: boolean;
}

export function PaymentRailTabs({ activeRail, onChange, canManage: _canManage }: PaymentRailTabsProps) {
  return (
    <div role="tablist" aria-label="Payment rails" className="flex flex-wrap gap-2">
      {RAIL_TABS.map(({ rail }) => {
        const active = rail === activeRail;
        return (
          <button
            key={rail}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`rail-panel-${rail}`}
            id={`rail-tab-${rail}`}
            onClick={() => onChange(rail)}
            className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 motion-reduce:transition-none ${
              active
                ? 'border-navy-900 bg-navy-900 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="hidden sm:inline">{PAYMENT_RAIL_LABELS[rail]}</span>
            <span className="sm:hidden">{PAYMENT_RAIL_LABELS[rail].split('/')[0].trim()}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface PaymentRailPropsInternal {
  rail: PaymentRailType;
  enabled: boolean;
  children: ReactNode;
  balance?: number | null;
}

export function PaymentRail({ rail, enabled, children }: PaymentRailPropsInternal) {
  const label = PAYMENT_RAIL_LABELS[rail];
  const description = PAYMENT_RAIL_DESCRIPTIONS[rail];

  return (
    <section
      id={`rail-panel-${rail}`}
      role="tabpanel"
      aria-labelledby={`rail-tab-${rail}`}
      aria-label={`${label} payment rail`}
      className="scroll-mt-6"
    >
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                {label}
                {!enabled && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/15">
                    View only
                  </span>
                )}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200" aria-hidden="true">
              <DashboardIcon name="wallet" className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {!enabled && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" role="status" aria-live="polite">
              <div className="flex gap-2.5">
                <DashboardIcon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-800">You have view-only access</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Only organization Owners and Admins can initiate payments or request invoices. Contact your workspace owner to get access.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className={enabled ? '' : 'pointer-events-none opacity-60'} aria-disabled={!enabled}>
            {children}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export interface RailMessageProps {
  message: string | null;
  error: string | null;
  busy?: boolean;
}

export function RailMessage({ message, error }: RailMessageProps) {
  return (
    <>
      {message && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-100" role="status" aria-live="polite">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-100" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </>
  );
}
