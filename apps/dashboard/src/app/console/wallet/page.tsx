'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';

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
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  // M-Pesa state
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [stkMessage, setStkMessage] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [stkBusy, setStkBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Card state
  const [cardAmount, setCardAmount] = useState('');
  const [cardMessage, setCardMessage] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);
  const [cardNeedsConfirm, setCardNeedsConfirm] = useState(false);
  // PayPal state
  const [paypalAmount, setPaypalAmount] = useState('');
  const [paypalMessage, setPaypalMessage] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [paypalPaymentId, setPaypalPaymentId] = useState<string | null>(null);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState<string | null>(null);

  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!token) return;
    const bal = await apiFetch<{ balance: number; currency: string }>('/wallet', { token });
    setBalance(bal.balance);
    const ledger = await apiFetch<{ items: Tx[] }>('/wallet/transactions', { token });
    setTxs(ledger.items);
    if (canManage) {
      const reqs = await apiFetch<TopUp[]>('/wallet/top-ups', { token });
      setTopUps(reqs);
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
    try {
      await apiFetch('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
        token,
      });
      setMsg('Top-up requested. Fleektech will issue an invoice; the wallet is credited on approval.');
      setAmount('');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
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
      setStkMessage(payment.message ?? 'STK push sent…');

      // Poll until the payment settles or 90s elapse.
      const started = Date.now();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await apiFetch<StkPayment>(`/payments/stk/${payment.id}`, { token }).catch(() => null);
        if (!s) return;
        if (s.status === 'paid') {
          setStkMessage('✅ Payment received — wallet credited.');
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

  /** Shared settler-poll for card/PayPal: the status endpoint works for any rail. */
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
      setCardMessage(res.message ?? 'Card payment started…');
      if (!res.sandbox && res.clientSecret) setCardNeedsConfirm(true);
      pollOnlinePayment(
        res.id,
        Date.now(),
        () => {
          setCardMessage('✅ Payment received — wallet credited.');
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
        setCardMessage('✅ Payment received — wallet credited.');
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
      setPaypalMessage(res.message ?? 'PayPal payment started…');
      if (!res.sandbox && res.approvalUrl) setPaypalApprovalUrl(res.approvalUrl);
      pollOnlinePayment(
        res.id,
        Date.now(),
        () => {
          setPaypalMessage('✅ Payment received — wallet credited.');
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
        setPaypalMessage('✅ Payment received — wallet credited.');
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

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold font-display">Wallet</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-navy-900 text-white border-navy-900">
          <p className="text-sm text-slate-300">Available balance</p>
          <p className="mt-1 text-3xl font-bold brand-gradient-text">
            {balance != null ? `KES ${balance.toLocaleString()}` : '…'}
          </p>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Pay with M-Pesa</CardTitle>
            <CardDescription>Instant STK push top-up — enter your Safaricom PIN when prompted.</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={payWithMpesa} className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Label htmlFor="mpesaAmount">KES</Label>
                  <Input
                    id="mpesaAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={mpesaAmount}
                    onChange={(e) => setMpesaAmount(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <Label htmlFor="mpesaPhone">Phone</Label>
                  <Input
                    id="mpesaPhone"
                    required
                    placeholder="0712345678"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={stkBusy}>
                  {stkBusy ? 'Waiting for PIN…' : 'Pay now'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Only Owners/Admins can initiate payments.</p>
            )}
            {stkMessage && <p className="mt-3 text-xs font-medium text-teal-brand">{stkMessage}</p>}
            {stkError && <p className="mt-3 text-xs text-red-500">{stkError}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Pay with card</CardTitle>
            <CardDescription>Visa / Mastercard top-up — settles instantly in sandbox.</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={payWithCard} className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Label htmlFor="cardAmount">KES</Label>
                  <Input
                    id="cardAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={cardBusy}>
                  {cardBusy ? 'Processing…' : 'Pay with card'}
                </Button>
                {cardNeedsConfirm && cardPaymentId && (
                  <Button type="button" variant="secondary" onClick={() => void confirmCard()}>
                    I&apos;ve completed the card step — confirm
                  </Button>
                )}
              </form>
            ) : (
              <p className="text-sm text-slate-400">Only Owners/Admins can initiate payments.</p>
            )}
            {cardMessage && <p className="mt-3 text-xs font-medium text-teal-brand">{cardMessage}</p>}
            {cardError && <p className="mt-3 text-xs text-red-500">{cardError}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Pay with PayPal</CardTitle>
            <CardDescription>Approve in PayPal, then capture — settles instantly in sandbox.</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={payWithPayPal} className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Label htmlFor="paypalAmount">KES</Label>
                  <Input
                    id="paypalAmount"
                    required
                    type="number"
                    min={100}
                    step={50}
                    placeholder="1000"
                    value={paypalAmount}
                    onChange={(e) => setPaypalAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={paypalBusy}>
                  {paypalBusy ? 'Processing…' : 'Pay with PayPal'}
                </Button>
                {paypalApprovalUrl && (
                  <a
                    href={paypalApprovalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-teal-brand hover:underline"
                  >
                    Approve in PayPal ↗
                  </a>
                )}
                {paypalPaymentId && (
                  <Button type="button" variant="secondary" onClick={() => void capturePayPal()}>
                    I&apos;ve approved — capture payment
                  </Button>
                )}
              </form>
            ) : (
              <p className="text-sm text-slate-400">Only Owners/Admins can initiate payments.</p>
            )}
            {paypalMessage && <p className="mt-3 text-xs font-medium text-teal-brand">{paypalMessage}</p>}
            {paypalError && <p className="mt-3 text-xs text-red-500">{paypalError}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Or request an invoice</CardTitle>
            <CardDescription>
              Manual invoicing — minimum KES 1,000. Credited after admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form onSubmit={requestTopUp} className="flex gap-3">
                <div className="w-40">
                  <Input
                    required
                    type="number"
                    min={1000}
                    step={500}
                    placeholder="Amount (KES)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Request invoice
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Only Owners/Admins can request top-ups.</p>
            )}
            {msg && <p className="mt-3 text-xs text-teal-brand">{msg}</p>}

            {topUps.length > 0 && (
              <ul className="mt-5 space-y-2">
                {topUps.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>KES {(Number(t.amountMinor) / 100).toLocaleString()}</span>
                    <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</span>
                    <Badge tone={t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'amber'}>
                      {t.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Balance after</th>
                  <th className="pb-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5">{t.description ?? '—'}</td>
                    <td className="py-2.5">
                      <Badge tone={t.type === 'topup' ? 'green' : 'blue'}>{t.type}</Badge>
                    </td>
                    <td className={`py-2.5 text-right font-medium ${t.type === 'topup' ? 'text-emerald-600' : ''}`}>
                      {t.type === 'topup' ? '+' : '−'}KES {Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">KES {t.balanceAfter.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {new Date(t.createdAt).toLocaleString()}
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
