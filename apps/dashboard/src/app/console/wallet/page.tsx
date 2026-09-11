'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';
import { WalletHero, WalletActivitySummary } from '@/components/wallet-summary';
import { PaymentRail, PaymentRailTabs, RailMessage } from '@/components/payment-rail';
import { downloadReport, buildWalletStatementUrl } from '@/lib/exports';
import {
  formatLedgerAmount,
  isTopUpTransaction,
  canInitiatePayments,
  type PaymentRailType,
} from '@/lib/wallet';
import { DashboardIcon } from '@/components/dashboard-icons';

interface Tx {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface TopUp {
  id: string;
  amountMinor: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

interface BankDetails {
  paybillNumber: string;
  paybillAccount: string;
  bankName: string;
  bankBranch: string;
  accountName: string;
}

interface StkPayment {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  message?: string;
}

interface OnlinePayment {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  clientSecret?: string | null;
  approvalUrl?: string | null;
  sandbox?: boolean;
  message?: string;
}

export default function WalletPage() {
  const { token, user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeRail, setActiveRail] = useState<PaymentRailType>('mpesa');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Invoice (top-up request) state
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  // M-Pesa
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [stkMessage, setStkMessage] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [stkBusy, setStkBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bank
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankAmount, setBankAmount] = useState('');
  const [bankPhone, setBankPhone] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [bankMessage, setBankMessage] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankBusy, setBankBusy] = useState(false);

  // Card
  const [cardAmount, setCardAmount] = useState('');
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);
  const [cardNeedsConfirm, setCardNeedsConfirm] = useState(false);

  // PayPal
  const [paypalAmount, setPaypalAmount] = useState('');
  const [paypalMessage, setPaypalMessage] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [paypalPaymentId, setPaypalPaymentId] = useState<string | null>(null);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState<string | null>(null);

  const canManage = canInitiatePayments(user?.role);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const bal = await apiFetch<{ balance: number; currency: string }>('/wallet', { token });
      setBalance(bal.balance);
      const ledger = await apiFetch<{ items: Tx[] }>('/wallet/transactions', { token });
      setTxs(ledger.items);
      if (canManage) {
        const reqs = await apiFetch<TopUp[]>('/wallet/top-ups', { token });
        setTopUps(reqs);
      }
      if (canManage) {
        const details = await apiFetch<BankDetails>('/payments/bank-details', { token }).catch(
          () => null,
        );
        if (details) setBankDetails(details);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  useEffect(() => {
    void load().catch(() => undefined);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  async function requestTopUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setInvoiceError(null);
    setInvoiceBusy(true);
    try {
      await apiFetch('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
        token,
      });
      setMsg(
        'Top-up requested. Fleektech will issue an invoice; the wallet is credited on approval.',
      );
      setAmount('');
      await load();
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function payWithMpesa(e: React.FormEvent) {
    e.preventDefault();
    setStkError(null);
    setStkMessage(null);
    setStkBusy(true);
    try {
      const payment = await apiFetch<StkPayment>('/payments/stk', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(mpesaAmount), phone: mpesaPhone }),
        token,
      });
      setStkMessage(payment.message ?? 'STK push sent — enter your M-Pesa PIN when prompted.');

      const started = Date.now();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await apiFetch<StkPayment>(`/payments/stk/${payment.id}`, { token }).catch(
          () => null,
        );
        if (!s) return;
        if (s.status === 'paid') {
          setStkMessage('Payment received — wallet credited.');
          setStkBusy(false);
          if (pollRef.current) clearInterval(pollRef.current);
          void load();
        } else if (s.status === 'failed') {
          setStkError('Payment failed or was cancelled.');
          setStkBusy(false);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (Date.now() - started > 90_000) {
          setStkError('Timed out waiting for M-Pesa confirmation.');
          setStkBusy(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2000);
    } catch (err) {
      setStkError(err instanceof Error ? err.message : 'Failed to start payment');
      setStkBusy(false);
    }
  }

  async function confirmBankTransfer(e: React.FormEvent) {
    e.preventDefault();
    setBankError(null);
    setBankMessage(null);
    setBankBusy(true);
    try {
      const res = await apiFetch<{ message?: string }>('/payments/bank/confirm', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(bankAmount), phone: bankPhone, paybillRef: bankRef }),
        token,
      });
      setBankMessage(
        res.message ?? 'Bank/Paybill transfer recorded. Wallet will be credited on confirmation.',
      );
      setBankAmount('');
      setBankRef('');
      await load();
    } catch (err) {
      setBankError(err instanceof Error ? err.message : 'Failed to record transfer');
    } finally {
      setBankBusy(false);
    }
  }

  function pollOnlinePayment(
    id: string,
    started: number,
    onPaid: () => void,
    onFailed: (msg: string) => void,
  ) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await apiFetch<StkPayment>(`/payments/stk/${id}`, { token }).catch(() => null);
      if (!s) return;
      if (s.status === 'paid') {
        onPaid();
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (s.status === 'failed') {
        onFailed('Payment failed or was cancelled.');
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (Date.now() - started > 90_000) {
        onFailed('Timed out waiting for confirmation.');
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function payWithCard(e: React.FormEvent) {
    e.preventDefault();
    setCardError(null);
    setCardMessage(null);
    setCardNeedsConfirm(false);
    setCardBusy(true);
    try {
      const res = await apiFetch<OnlinePayment>('/payments/card', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(cardAmount) }),
        token,
      });
      setCardPaymentId(res.id);
      setCardMessage(
        res.message ??
          (res.sandbox
            ? 'SANDBOX MODE — card payment auto-completes in a few seconds'
            : 'Card payment intent created — complete it, then confirm.'),
      );
      if (!res.sandbox && res.clientSecret) setCardNeedsConfirm(true);
      pollOnlinePayment(
        res.id,
        Date.now(),
        () => {
          setCardMessage('Payment received — wallet credited.');
          setCardBusy(false);
          setCardNeedsConfirm(false);
          void load();
        },
        (msg) => {
          setCardError(msg);
          setCardBusy(false);
        },
      );
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to start payment');
      setCardBusy(false);
    }
  }

  async function confirmCard() {
    if (!cardPaymentId) return;
    setCardError(null);
    try {
      const res = await apiFetch<OnlinePayment>(`/payments/card/${cardPaymentId}/confirm`, {
        method: 'POST',
        token,
      });
      if (res.status === 'paid') {
        stopPolling();
        setCardMessage('Payment received — wallet credited.');
        setCardBusy(false);
        setCardNeedsConfirm(false);
        void load();
      } else if (res.status === 'failed') {
        stopPolling();
        setCardError('Payment failed or was cancelled.');
        setCardBusy(false);
      } else {
        setCardMessage('Payment still processing — complete the card step, then confirm again.');
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Confirm failed');
    }
  }

  async function payWithPayPal(e: React.FormEvent) {
    e.preventDefault();
    setPaypalError(null);
    setPaypalMessage(null);
    setPaypalApprovalUrl(null);
    setPaypalBusy(true);
    try {
      const res = await apiFetch<OnlinePayment>('/payments/paypal', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paypalAmount) }),
        token,
      });
      setPaypalPaymentId(res.id);
      setPaypalMessage(
        res.message ??
          (res.sandbox
            ? 'SANDBOX MODE — PayPal payment auto-completes in a few seconds'
            : 'PayPal order created — approve it, then capture.'),
      );
      if (!res.sandbox && res.approvalUrl) setPaypalApprovalUrl(res.approvalUrl);
      pollOnlinePayment(
        res.id,
        Date.now(),
        () => {
          setPaypalMessage('Payment received — wallet credited.');
          setPaypalBusy(false);
          void load();
        },
        (msg) => {
          setPaypalError(msg);
          setPaypalBusy(false);
        },
      );
    } catch (err) {
      setPaypalError(err instanceof Error ? err.message : 'Failed to start payment');
      setPaypalBusy(false);
    }
  }

  async function capturePayPal() {
    if (!paypalPaymentId) return;
    setPaypalError(null);
    try {
      const res = await apiFetch<OnlinePayment>(`/payments/paypal/${paypalPaymentId}/capture`, {
        method: 'POST',
        token,
      });
      if (res.status === 'paid') {
        stopPolling();
        setPaypalMessage('Payment received — wallet credited.');
        setPaypalBusy(false);
        void load();
      } else if (res.status === 'failed') {
        stopPolling();
        setPaypalError('Payment failed or was cancelled.');
        setPaypalBusy(false);
      } else {
        setPaypalMessage('Order not approved yet — approve in PayPal, then capture again.');
      }
    } catch (err) {
      setPaypalError(err instanceof Error ? err.message : 'Capture failed');
    }
  }

  async function handleExport(format: 'csv' | 'pdf' | 'xlsx') {
    setExporting(format);
    setExportError(null);
    try {
      const url = buildWalletStatementUrl({}, format as 'csv' | 'pdf' | 'xlsx');
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `fleek-wallet-statement-${stamp}.${format}`;
      await downloadReport(url, filename, token);
    } catch {
      setExportError('Statement export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            Financial control
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 md:text-3xl">
            Wallet
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Top up your organization wallet and track every credit and debit with a running balance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void load()}
            aria-label="Refresh wallet data"
            className="h-11"
          >
            <DashboardIcon name="refresh" className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Hero + activity */}
      <WalletHero
        balance={balance}
        currency="KES"
        loading={loading}
        onExportCsv={() => void handleExport('csv')}
        onExportPdf={() => void handleExport('pdf')}
        exporting={exporting}
      />
      <WalletActivitySummary transactions={txs} topUps={topUps} loading={loading} />

      {loadError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()} className="h-11">
              Retry
            </Button>
          </div>
        </div>
      )}

      {exportError && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-800">{exportError}</p>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Permission banner for non-initiators */}
      {!canManage && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
          role="status"
          aria-live="polite"
          aria-label="Payment permissions"
        >
          <div className="flex gap-3">
            <DashboardIcon
              name="info"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-amber-800">View-only wallet access</h2>
              <p className="mt-1 text-sm leading-6 text-amber-700">
                Your role (<span className="font-medium">{user?.role ?? 'Member'}</span>) cannot
                initiate payments or request invoices. Only Owners and Admins can top up the wallet.
                Contact your organization owner for access.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rail tabs */}
      <section aria-label="Payment rails" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Payment rails
          </h2>
          <span className="text-xs text-slate-400">
            Choose a rail — each shows sandbox/live context and status.
          </span>
        </div>
        <PaymentRailTabs activeRail={activeRail} onChange={setActiveRail} canManage={canManage} />

        <div className="space-y-4">
          {activeRail === 'mpesa' && (
            <PaymentRail rail="mpesa" enabled={canManage}>
              <form
                onSubmit={payWithMpesa}
                className="flex flex-wrap items-end gap-3"
                aria-label="M-Pesa payment form"
              >
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor="mpesaAmount">Amount (KES)</Label>
                  <Input
                    id="mpesaAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={mpesaAmount}
                    onChange={(e) => setMpesaAmount(e.target.value)}
                    disabled={!canManage || stkBusy}
                    aria-label="M-Pesa amount in KES"
                  />
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  <Label htmlFor="mpesaPhone">Phone</Label>
                  <Input
                    id="mpesaPhone"
                    required
                    placeholder="0712345678"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    disabled={!canManage || stkBusy}
                    aria-label="M-Pesa phone number"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!canManage || stkBusy}
                  aria-busy={stkBusy}
                  className="h-11"
                >
                  {stkBusy ? 'Waiting for PIN…' : 'Pay now'}
                </Button>
              </form>
              <RailMessage message={stkMessage} error={stkError} busy={stkBusy} />
            </PaymentRail>
          )}

          {activeRail === 'bank' && (
            <PaymentRail rail="bank" enabled={canManage}>
              {bankDetails && (
                <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bank / Paybill details
                  </p>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Paybill</dt>
                      <dd className="font-medium tabular-nums text-navy-900">
                        {bankDetails.paybillNumber}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Account</dt>
                      <dd className="font-medium tabular-nums text-navy-900">
                        {bankDetails.paybillAccount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Bank</dt>
                      <dd className="font-medium text-navy-900">
                        {bankDetails.bankName} — {bankDetails.bankBranch}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Account name</dt>
                      <dd className="font-medium text-navy-900">{bankDetails.accountName}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-400">
                    Transfer via bank or M-Pesa Paybill, then confirm below with the M-Pesa
                    reference.
                  </p>
                </div>
              )}
              <form
                onSubmit={confirmBankTransfer}
                className="flex flex-wrap items-end gap-3"
                aria-label="Bank transfer confirmation form"
              >
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor="bankAmount">Amount (KES)</Label>
                  <Input
                    id="bankAmount"
                    required
                    type="number"
                    min={100}
                    step={100}
                    placeholder="5000"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    disabled={!canManage || bankBusy}
                  />
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  <Label htmlFor="bankPhone">Phone</Label>
                  <Input
                    id="bankPhone"
                    required
                    placeholder="0712345678"
                    value={bankPhone}
                    onChange={(e) => setBankPhone(e.target.value)}
                    disabled={!canManage || bankBusy}
                  />
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  <Label htmlFor="bankRef">Paybill reference</Label>
                  <Input
                    id="bankRef"
                    required
                    placeholder="e.g. QK12AB34CD"
                    value={bankRef}
                    onChange={(e) => setBankRef(e.target.value)}
                    disabled={!canManage || bankBusy}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!canManage || bankBusy}
                  aria-busy={bankBusy}
                  className="h-11"
                >
                  {bankBusy ? 'Recording…' : 'Confirm transfer'}
                </Button>
              </form>
              <RailMessage message={bankMessage} error={bankError} busy={bankBusy} />
            </PaymentRail>
          )}

          {activeRail === 'card' && (
            <PaymentRail rail="card" enabled={canManage}>
              <form
                onSubmit={payWithCard}
                className="flex flex-wrap items-end gap-3"
                aria-label="Card payment form"
              >
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor="cardAmount">Amount (KES)</Label>
                  <Input
                    id="cardAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    disabled={!canManage || cardBusy}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!canManage || cardBusy}
                  aria-busy={cardBusy}
                  className="h-11"
                >
                  {cardBusy ? 'Processing…' : 'Pay with card'}
                </Button>
                {cardNeedsConfirm && cardPaymentId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void confirmCard()}
                    className="h-11"
                    disabled={!canManage}
                  >
                    I&apos;ve completed the card step — confirm
                  </Button>
                )}
              </form>
              <RailMessage message={cardMessage} error={cardError} busy={cardBusy} />
            </PaymentRail>
          )}

          {activeRail === 'paypal' && (
            <PaymentRail rail="paypal" enabled={canManage}>
              <form
                onSubmit={payWithPayPal}
                className="flex flex-wrap items-end gap-3"
                aria-label="PayPal payment form"
              >
                <div className="flex w-32 flex-col gap-1.5">
                  <Label htmlFor="paypalAmount">Amount (KES)</Label>
                  <Input
                    id="paypalAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={paypalAmount}
                    onChange={(e) => setPaypalAmount(e.target.value)}
                    disabled={!canManage || paypalBusy}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!canManage || paypalBusy}
                  aria-busy={paypalBusy}
                  className="h-11"
                >
                  {paypalBusy ? 'Processing…' : 'Pay with PayPal'}
                </Button>
                {paypalApprovalUrl && (
                  <a
                    href={paypalApprovalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-teal-700 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                  >
                    Approve in PayPal{' '}
                    <DashboardIcon name="external" className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
                {paypalPaymentId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void capturePayPal()}
                    className="h-11"
                    disabled={!canManage}
                  >
                    I&apos;ve approved — capture payment
                  </Button>
                )}
              </form>
              <RailMessage message={paypalMessage} error={paypalError} busy={paypalBusy} />
            </PaymentRail>
          )}

          {activeRail === 'invoice' && (
            <PaymentRail rail="invoice" enabled={canManage}>
              <form
                onSubmit={requestTopUp}
                className="flex flex-wrap items-end gap-3"
                aria-label="Invoice request form"
              >
                <div className="flex w-40 flex-col gap-1.5">
                  <Label htmlFor="invoiceAmount">Amount (KES)</Label>
                  <Input
                    id="invoiceAmount"
                    required
                    type="number"
                    min={1000}
                    step={500}
                    placeholder="5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!canManage || invoiceBusy}
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!canManage || invoiceBusy}
                  aria-busy={invoiceBusy}
                  className="h-11"
                >
                  {invoiceBusy ? 'Requesting…' : 'Request invoice'}
                </Button>
              </form>
              <RailMessage message={msg} error={invoiceError} busy={invoiceBusy} />
              {topUps.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recent invoice requests
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {topUps.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-slate-200"
                      >
                        <span className="font-medium tabular-nums text-navy-900">
                          KES {(Number(t.amountMinor) / 100).toLocaleString('en-KE')}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">
                          {new Date(t.createdAt).toLocaleDateString('en-KE')}
                        </span>
                        <Badge
                          tone={
                            t.status === 'approved'
                              ? 'green'
                              : t.status === 'rejected'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {t.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </PaymentRail>
          )}
        </div>
      </section>

      {/* Ledger */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100">
          <div className="min-w-0">
            <CardTitle>Ledger</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Sign-aware amounts, running balance, and exportable history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport('csv')}
              disabled={!!exporting}
              aria-label="Export ledger as CSV"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
            >
              <DashboardIcon name="download" className="h-3.5 w-3.5" aria-hidden="true" />
              {exporting === 'csv' ? 'Exporting…' : 'CSV'}
            </button>
            <button
              type="button"
              onClick={() => void handleExport('pdf')}
              disabled={!!exporting}
              aria-label="Export ledger as PDF"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-navy-900 px-3 text-xs font-semibold text-white hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50 motion-reduce:transition-none"
            >
              <DashboardIcon name="file" className="h-3.5 w-3.5" aria-hidden="true" />
              {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6" aria-busy="true" aria-live="polite">
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-slate-50"
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          ) : txs.length === 0 ? (
            <div className="px-6 py-10 text-center" role="status" aria-live="polite">
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                aria-hidden="true"
              >
                <DashboardIcon name="clipboard" className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-navy-900">No transactions yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Top up via any rail above — movements will appear here with running balance.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Wallet ledger">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Description
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Balance after
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txs.map((t) => {
                    const isCredit = isTopUpTransaction(t.type);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 motion-reduce:transition-none">
                        <td className="px-4 py-3.5 text-navy-900">{t.description ?? '—'}</td>
                        <td className="px-4 py-3.5">
                          <Badge tone={isCredit ? 'green' : 'blue'}>{t.type}</Badge>
                        </td>
                        <td
                          className={`px-4 py-3.5 text-right font-medium tabular-nums ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {formatLedgerAmount(t)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                          KES {t.balanceAfter.toLocaleString('en-KE')}
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs tabular-nums text-slate-400">
                          <time dateTime={t.createdAt} title={t.createdAt}>
                            {new Date(t.createdAt).toLocaleString('en-KE')}
                          </time>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
