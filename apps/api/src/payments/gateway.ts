/**
 * Payment gateway abstraction for M-Pesa STK Push.
 *
 * Two implementations ship:
 *  - DarajaGateway : real Safaricom Daraja API (sandbox or production),
 *                    enabled when DARAJA_CONSUMER_KEY + SECRET are configured.
 *  - MockGateway   : dev/test — auto-completes after a short delay so the
 *                    full top-up flow works without credentials.
 *
 * Add real credentials later via env; nothing else changes.
 */

export interface StkInitiation {
  merchantRequestId: string;
  checkoutRequestId: string;
}

export interface StkQueryResult {
  status: 'pending' | 'paid' | 'failed';
  mpesaReceipt?: string;
  resultDesc?: string;
}

export interface PaymentGateway {
  readonly name: string;
  readonly live: boolean;
  initiateStk(input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation>;
  queryStk(checkoutRequestId: string): Promise<StkQueryResult>;
}

const TOKEN_TTL_MS = 55 * 60 * 1000;

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  /** 'sandbox' | 'production' */
  environment: string;
}

export class DarajaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DarajaError';
  }
}

/** Safaricom Daraja STK Push (Lipa na M-Pesa Online). */
export class DarajaGateway implements PaymentGateway {
  readonly name = 'daraja';
  readonly live = true;

  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly cfg: DarajaConfig) {
    this.baseUrl =
      cfg.environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  /** OAuth token, cached until ~5min before expiry. */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const auth = Buffer.from(`${this.cfg.consumerKey}:${this.cfg.consumerSecret}`).toString('base64');
    const res = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) throw new DarajaError(`Token request failed (${res.status})`);
    const data = (await res.json()) as { access_token: string; expires_in: string };
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + Math.min(parseInt(data.expires_in ?? '3599', 10) * 1000, TOKEN_TTL_MS);
    if (!this.token) throw new DarajaError('No access token in response');
    return this.token;
  }

  private timestamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  private password(timestamp: string): string {
    return Buffer.from(`${this.cfg.shortcode}${this.cfg.passkey}${timestamp}`).toString('base64');
  }

  async initiateStk(input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation> {
    const token = await this.accessToken();
    const timestamp = this.timestamp();

    // Daraja expects 2547XXXXXXXX and whole KES amounts.
    const msisdn = input.phone.replace(/^0/, '254').replace(/^\+/, '');
    const amount = Number(input.amountMinor / BigInt(100));

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: this.cfg.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: msisdn,
        PartyB: this.cfg.shortcode,
        PhoneNumber: msisdn,
        CallBackURL: `${this.cfg.callbackUrl}?reference=${encodeURIComponent(input.reference)}`,
        AccountReference: input.reference.slice(0, 12), // ≤12 alphanumeric
        TransactionDesc: 'Fleek IPRS wallet top-up',
      }),
    });

    const data = (await res.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      errorMessage?: string;
      ResponseDescription?: string;
    };
    if (!res.ok || !data.CheckoutRequestID) {
      throw new DarajaError(data.errorMessage ?? `STK push failed (${res.status})`);
    }
    return {
      merchantRequestId: data.MerchantRequestID ?? '',
      checkoutRequestId: data.CheckoutRequestID,
    };
  }

  async queryStk(checkoutRequestId: string): Promise<StkQueryResult> {
    const token = await this.accessToken();
    const timestamp = this.timestamp();

    const res = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: this.cfg.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const data = (await res.json()) as {
      ResultCode?: string;
      ResultDesc?: string;
      MpesaReceiptNumber?: string;
      errorMessage?: string;
    };

    if (data.errorMessage?.includes('The transaction is being processed')) {
      return { status: 'pending' };
    }
    if (data.ResultCode === '0') {
      return { status: 'paid', mpesaReceipt: data.MpesaReceiptNumber, resultDesc: data.ResultDesc };
    }
    if (data.ResultCode != null) {
      return { status: 'failed', resultDesc: data.ResultDesc };
    }
    return { status: 'pending' };
  }
}

/** Auto-completing fake for development and CI. */
export class MockGateway implements PaymentGateway {
  readonly name = 'mock-gateway';
  readonly live = false;
  private readonly completions = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly onAutoComplete?: (checkoutRequestId: string) => void) {}

  async initiateStk(_input: { amountMinor: bigint; phone: string; reference: string }): Promise<StkInitiation> {
    const checkoutRequestId = `ws_CO_MOCK_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    this.completions.set(
      checkoutRequestId,
      setTimeout(() => {
        this.onAutoComplete?.(checkoutRequestId);
        this.completions.delete(checkoutRequestId);
      }, 3000),
    );
    return { merchantRequestId: `MR_${checkoutRequestId}`, checkoutRequestId };
  }

  async queryStk(checkoutRequestId: string): Promise<StkQueryResult> {
    if (this.completions.has(checkoutRequestId)) return { status: 'pending' };
    return { status: 'paid', mpesaReceipt: `MOCK${checkoutRequestId.slice(-8)}`, resultDesc: 'Mock payment accepted' };
  }
}
