import { Injectable, Logger } from '@nestjs/common';
import { StkPayment, PaymentMethod } from '@fleek/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  DarajaGateway,
  MockGateway,
  type PaymentGateway,
} from './gateway';
import { normalizeKePhone } from '../common/phone';

/**
 * Orchestrates wallet top-ups via multiple rails:
 *   - M-Pesa STK Push (DarajaGateway / MockGateway)
 *   - Bank Transfer / Paybill (manual confirm)
 *   - Card via Stripe (PaymentIntent; mock auto-completes without keys)
 *   - PayPal (Orders v2; mock auto-completes without keys)
 *
 * Every rail is credential-gated: empty env = sandbox mock that settles so
 * the full top-up flow works without provider accounts. Nothing else changes.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');
  readonly gateway: PaymentGateway;

  // Paybill constants
  static readonly PAYBILL_NUMBER = process.env.PAYBILL_NUMBER ?? '880100';
  static readonly PAYBILL_ACCOUNT = process.env.PAYBILL_ACCOUNT ?? '8402250011';
  static readonly BANK_NAME = process.env.BANK_NAME ?? 'NCBA';
  static readonly BANK_BRANCH = process.env.BANK_BRANCH ?? 'Uphill';
  static readonly ACCOUNT_NAME = process.env.ACCOUNT_NAME ?? 'SPIN MOBILE LIMITED';

  constructor(private readonly prisma: PrismaService) {
    const {
      DARAJA_CONSUMER_KEY,
      DARAJA_CONSUMER_SECRET,
      DARAJA_SHORTCODE,
      DARAJA_PASSKEY,
      DARAJA_ENV,
      DARAJA_CALLBACK_URL,
    } = process.env;

    if (DARAJA_CONSUMER_KEY && DARAJA_CONSUMER_SECRET && DARAJA_SHORTCODE && DARAJA_PASSKEY) {
      this.gateway = new DarajaGateway({
        consumerKey: DARAJA_CONSUMER_KEY,
        consumerSecret: DARAJA_CONSUMER_SECRET,
        shortcode: DARAJA_SHORTCODE,
        passkey: DARAJA_PASSKEY,
        environment: DARAJA_ENV ?? 'sandbox',
        callbackUrl: DARAJA_CALLBACK_URL ?? 'https://api.fleekiprs.co.ke/v1/payments/callback',
      });
      this.logger.log(`Using LIVE Daraja gateway (${DARAJA_ENV ?? 'sandbox'})`);
    } else {
      this.gateway = new MockGateway((checkoutRequestId) => {
        void this.autoComplete(checkoutRequestId);
      });
      this.logger.warn('Daraja credentials not configured — using MOCK payment gateway (auto-completes)');
    }
  }

  get gatewayName(): string {
    return this.gateway.name;
  }

  /** Get paybill/bank details for manual transfer */
  getBankDetails() {
    return {
      paybillNumber: PaymentsService.PAYBILL_NUMBER,
      paybillAccount: PaymentsService.PAYBILL_ACCOUNT,
      bankName: PaymentsService.BANK_NAME,
      bankBranch: PaymentsService.BANK_BRANCH,
      accountName: PaymentsService.ACCOUNT_NAME,
    };
  }

  // ===== M-Pesa STK Push =====

  async initiateStkPush(orgId: string, userId: string, amountKes: number, phone: string): Promise<StkPayment> {
    if (!Number.isFinite(amountKes) || amountKes < 100) {
      throw new Error('Minimum M-Pesa top-up is KES 100');
    }

    const payment = await this.prisma.client.stkPayment.create({
      data: {
        organizationId: orgId,
        userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
        phone: normalizeKePhone(phone).replace(/^\+/, ''),
        method: PaymentMethod.stk,
      },
    });

    const initiation = await this.gateway.initiateStk({
      amountMinor: payment.amountMinor,
      phone: payment.phone,
      reference: payment.id,
    });

    return this.prisma.client.stkPayment.update({
      where: { id: payment.id },
      data: {
        merchantRequestId: initiation.merchantRequestId,
        checkoutRequestId: initiation.checkoutRequestId,
      },
    });
  }

  /** Pull-based status check; complements the Daraja push callback. */
  async syncStatus(payment: StkPayment): Promise<StkPayment> {
    if (payment.status !== 'pending' || !payment.checkoutRequestId) return payment;
    if (payment.method !== PaymentMethod.stk) return payment;
    
    if (!this.gateway.live) {
      // Mock gateway auto-completes on its own timer.
      await this.autoComplete(payment.checkoutRequestId);
      return this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: payment.id } });
    }
    try {
      const result = await this.gateway.queryStk(payment.checkoutRequestId);
      if (result.status === 'pending') return payment;
      return this.finalize(payment.id, result.status === 'paid', result.mpesaReceipt, result.resultDesc);
    } catch (err) {
      this.logger.warn(`status sync failed for ${payment.id}: ${err instanceof Error ? err.message : err}`);
      return payment;
    }
  }

  /** Called by the public Daraja callback endpoint. */
  async applyCallback(input: {
    reference: string;
    checkoutRequestId: string;
    success: boolean;
    mpesaReceipt?: string;
    resultDesc?: string;
  }): Promise<void> {
    const payment = await this.prisma.client.stkPayment.findUnique({ where: { id: input.reference } });
    if (!payment || payment.checkoutRequestId !== input.checkoutRequestId) {
      throw new Error('Callback reference/checkout mismatch');
    }
    if (payment.status !== 'pending') return;
    await this.finalize(payment.id, input.success, input.mpesaReceipt, input.resultDesc);
  }

  private async autoComplete(checkoutRequestId: string): Promise<void> {
    try {
      const payment = await this.prisma.client.stkPayment.findUnique({ where: { checkoutRequestId } });
      if (!payment || payment.status !== 'pending') return;
      await this.finalize(
        payment.id,
        true,
        `MOCK${Date.now().toString().slice(-8)}`,
        'Mock gateway auto-completion',
      );
    } catch (err) {
      this.logger.warn(`auto-complete failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ===== Bank Transfer / Paybill (Manual Confirm) =====

  /** Record a bank/paybill payment that was made externally.
   * User provides the paybill reference from their M-Pesa confirmation SMS. */
  async confirmBankTransfer(
    orgId: string,
    userId: string,
    amountKes: number,
    paybillRef: string,
    phone: string,
  ): Promise<StkPayment> {
    if (!Number.isFinite(amountKes) || amountKes < 100) {
      throw new Error('Minimum top-up is KES 100');
    }
    if (!paybillRef || paybillRef.trim().length < 5) {
      throw new Error('Paybill reference is required (from M-Pesa confirmation SMS)');
    }

    const payment = await this.prisma.client.stkPayment.create({
      data: {
        organizationId: orgId,
        userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
        phone: normalizeKePhone(phone).replace(/^\+/, ''),
        method: PaymentMethod.bank,
        status: 'pending',
        paybillRef: paybillRef.trim(),
        merchantRequestId: `PAYBILL_${paybillRef.trim()}`,
      },
    });

    // For bank transfer, we don't have real-time callback - admin or user can confirm
    // For now, we'll mark as pending and let admin approve, or auto-approve if we trust the reference
    // In production, you'd verify with bank API or C2B callback
    return payment;
  }

  /** Admin or auto-confirmation of bank transfer */
  async confirmBankPayment(paymentId: string, success: boolean, receipt?: string, resultDesc?: string): Promise<StkPayment> {
    return this.finalize(paymentId, success, receipt, resultDesc);
  }

  // ===== Card via Stripe =====

  private get stripeSecretKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY || undefined;
  }

  /** Start a card top-up. Sandbox (no STRIPE_SECRET_KEY) auto-completes like M-Pesa mock. */
  async initiateCardTopUp(
    orgId: string,
    userId: string,
    amountKes: number,
  ): Promise<{ payment: StkPayment; clientSecret?: string; sandbox: boolean }> {
    if (!Number.isFinite(amountKes) || amountKes < 100) {
      throw new Error('Minimum card top-up is KES 100');
    }
    const payment = await this.prisma.client.stkPayment.create({
      data: {
        organizationId: orgId,
        userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
        phone: '',
        method: PaymentMethod.card,
      },
    });

    if (!this.stripeSecretKey) {
      const checkoutRequestId = `card_MOCK_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      await this.prisma.client.stkPayment.update({
        where: { id: payment.id },
        data: { merchantRequestId: `MR_${checkoutRequestId}`, checkoutRequestId },
      });
      this.scheduleMockCompletion(checkoutRequestId);
      const updated = await this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: payment.id } });
      return { payment: updated, sandbox: true };
    }

    const intent = await this.stripeCreatePaymentIntent(payment.amountMinor, payment.id);
    const updated = await this.prisma.client.stkPayment.update({
      where: { id: payment.id },
      data: { merchantRequestId: intent.id, checkoutRequestId: intent.id },
    });
    return { payment: updated, clientSecret: intent.client_secret, sandbox: false };
  }

  /** Confirm a card payment: live = check the PaymentIntent; sandbox = settle now. */
  async confirmCardPayment(paymentId: string): Promise<StkPayment> {
    const payment = await this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.method !== PaymentMethod.card || payment.status !== 'pending') return payment;
    if (!this.stripeSecretKey || !payment.checkoutRequestId) {
      if (payment.checkoutRequestId) await this.autoComplete(payment.checkoutRequestId);
      return this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });
    }
    const intent = await this.stripeRetrievePaymentIntent(payment.checkoutRequestId);
    if (intent.status === 'succeeded') {
      return this.finalize(payment.id, true, intent.id, 'Stripe card payment succeeded');
    }
    if (intent.status === 'canceled') {
      return this.finalize(payment.id, false, intent.id, 'Stripe card payment canceled');
    }
    return payment;
  }

  private async stripeCreatePaymentIntent(
    amountMinor: bigint,
    reference: string,
  ): Promise<{ id: string; client_secret: string }> {
    // Stripe treats KES as a 2-decimal currency, so minor units (cents) apply.
    const body = new URLSearchParams({
      amount: amountMinor.toString(),
      currency: 'kes',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      description: `Fleek IPRS wallet top-up ${reference}`,
    });
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = (await res.json()) as { id?: string; client_secret?: string; error?: { message?: string } };
    if (!res.ok || !data.id) throw new Error(data.error?.message ?? `Stripe intent failed (${res.status})`);
    return { id: data.id, client_secret: data.client_secret ?? '' };
  }

  private async stripeRetrievePaymentIntent(intentId: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intentId)}`, {
      headers: { Authorization: `Bearer ${this.stripeSecretKey}` },
    });
    const data = (await res.json()) as { status?: string; id?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `Stripe retrieve failed (${res.status})`);
    return { status: data.status ?? 'unknown', id: data.id ?? intentId };
  }

  // ===== PayPal (Orders v2) =====

  private get paypalClientId(): string | undefined {
    return process.env.PAYPAL_CLIENT_ID || undefined;
  }

  private get paypalSecret(): string | undefined {
    return process.env.PAYPAL_SECRET || undefined;
  }

  private get paypalLive(): boolean {
    return !!(this.paypalClientId && this.paypalSecret);
  }

  private get paypalBaseUrl(): string {
    return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  /** PayPal supports no KES — live orders use PAYPAL_CURRENCY (default USD). Sandbox credits KES directly. */
  private get paypalCurrency(): string {
    return process.env.PAYPAL_CURRENCY ?? 'USD';
  }

  /** Start a PayPal top-up. Returns an approval URL when live; sandbox auto-completes. */
  async initiatePayPalTopUp(
    orgId: string,
    userId: string,
    amountKes: number,
  ): Promise<{ payment: StkPayment; approvalUrl?: string; sandbox: boolean }> {
    if (!Number.isFinite(amountKes) || amountKes < 100) {
      throw new Error('Minimum PayPal top-up is KES 100');
    }
    const payment = await this.prisma.client.stkPayment.create({
      data: {
        organizationId: orgId,
        userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
        phone: '',
        method: PaymentMethod.paypal,
      },
    });

    if (!this.paypalLive) {
      const checkoutRequestId = `pp_MOCK_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      await this.prisma.client.stkPayment.update({
        where: { id: payment.id },
        data: { merchantRequestId: `MR_${checkoutRequestId}`, checkoutRequestId },
      });
      this.scheduleMockCompletion(checkoutRequestId);
      const updated = await this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: payment.id } });
      return { payment: updated, sandbox: true };
    }

    const order = await this.paypalCreateOrder(payment.amountMinor);
    const updated = await this.prisma.client.stkPayment.update({
      where: { id: payment.id },
      data: { merchantRequestId: order.id, checkoutRequestId: order.id },
    });
    return { payment: updated, approvalUrl: order.approvalUrl, sandbox: false };
  }

  /** Capture an approved PayPal order; sandbox settles immediately. */
  async capturePayPalPayment(paymentId: string): Promise<StkPayment> {
    const payment = await this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.method !== PaymentMethod.paypal || payment.status !== 'pending') return payment;
    if (!this.paypalLive || !payment.checkoutRequestId) {
      if (payment.checkoutRequestId) await this.autoComplete(payment.checkoutRequestId);
      return this.prisma.client.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });
    }
    const token = await this.paypalAccessToken();
    const res = await fetch(
      `${this.paypalBaseUrl}/v2/checkout/orders/${encodeURIComponent(payment.checkoutRequestId)}/capture`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    const data = (await res.json()) as { status?: string; id?: string };
    if (!res.ok) throw new Error(`PayPal capture failed (${res.status})`);
    if (data.status === 'COMPLETED') {
      return this.finalize(payment.id, true, data.id, 'PayPal payment captured');
    }
    return payment;
  }

  private async paypalAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.paypalClientId}:${this.paypalSecret}`).toString('base64');
    const res = await fetch(`${this.paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    const data = (await res.json()) as { access_token?: string };
    if (!res.ok || !data.access_token) throw new Error(`PayPal auth failed (${res.status})`);
    return data.access_token;
  }

  private async paypalCreateOrder(amountMinor: bigint): Promise<{ id: string; approvalUrl?: string }> {
    const token = await this.paypalAccessToken();
    // KES has no PayPal support — charge the configured currency; the KES
    // amountMinor recorded on our side is what gets credited on capture.
    const value = (Number(amountMinor) / 100).toFixed(2);
    const res = await fetch(`${this.paypalBaseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: this.paypalCurrency, value } }],
      }),
    });
    const data = (await res.json()) as { id?: string; links?: Array<{ rel: string; href: string }> };
    if (!res.ok || !data.id) throw new Error(`PayPal order failed (${res.status})`);
    return { id: data.id, approvalUrl: data.links?.find((l) => l.rel === 'approve')?.href };
  }

  /** Sandbox settlement timer shared by the card/PayPal mock rails. */
  private scheduleMockCompletion(checkoutRequestId: string): void {
    setTimeout(() => {
      void this.autoComplete(checkoutRequestId);
    }, 3000);
  }

  // ===== Unified Finalize =====

  /** Single place where a payment is settled and the wallet credited — atomically. */
  private async finalize(
    paymentId: string,
    success: boolean,
    receipt?: string,
    resultDesc?: string,
  ): Promise<StkPayment> {
    type Tx = Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0];

    return this.prisma.client.$transaction(async (tx: Tx) => {
      // Claim the payment row: only one finalizer wins.
      const claimed = await tx.stkPayment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: {
          status: success ? 'paid' : 'failed',
          mpesaReceipt: receipt ?? null,
          resultDesc: resultDesc ?? null,
          completedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        return tx.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });
      }
      const payment = await tx.stkPayment.findUniqueOrThrow({ where: { id: paymentId } });

      if (success) {
        const wallet = await tx.wallet.update({
          where: { organizationId: payment.organizationId },
          data: { balanceMinor: { increment: payment.amountMinor } },
        });
        await tx.transaction.create({
          data: {
            type: 'topup',
            amountMinor: payment.amountMinor,
            balanceAfter: wallet.balanceMinor,
            description: this.getTopupDescription(payment.method, receipt ?? payment.checkoutRequestId ?? payment.paybillRef ?? ''),
            walletId: wallet.id,
          },
        });
      }
      return payment;
    }).catch((err: unknown) => {
      this.logger.error(`finalize failed for ${paymentId}: ${err instanceof Error ? err.message : err}`);
      throw err;
    });
  }

  private getTopupDescription(method: PaymentMethod, reference: string): string {
    switch (method) {
      case PaymentMethod.stk:
        return `M-Pesa STK top-up (${reference})`;
      case PaymentMethod.bank:
        return `Bank/Paybill top-up (${reference})`;
      case PaymentMethod.card:
        return `Card top-up (${reference})`;
      case PaymentMethod.paypal:
        return `PayPal top-up (${reference})`;
      default:
        return `Wallet top-up (${reference})`;
    }
  }
}