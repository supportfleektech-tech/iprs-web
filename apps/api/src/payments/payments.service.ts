import { Injectable, Logger } from '@nestjs/common';
import { StkPayment } from '@fleek/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  DarajaGateway,
  MockGateway,
  type PaymentGateway,
} from './gateway';

/**
 * Orchestrates STK top-ups: initiation, status sync, callback handling and
 * wallet crediting. Gateway selection is automatic:
 *   DARAJA_CONSUMER_KEY + DARAJA_CONSUMER_SECRET set → real Daraja
 *   otherwise                                        → MockGateway (dev/CI)
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');
  readonly gateway: PaymentGateway;

  constructor(private readonly prisma: PrismaService) {
    const { DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_SHORTCODE, DARAJA_PASSKEY, DARAJA_ENV, DARAJA_CALLBACK_URL } =
      process.env;

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

  async initiateStkPush(orgId: string, userId: string, amountKes: number, phone: string): Promise<StkPayment> {
    if (!Number.isFinite(amountKes) || amountKes < 100) {
      throw new Error('Minimum M-Pesa top-up is KES 100');
    }

    const payment = await this.prisma.client.stkPayment.create({
      data: {
        organizationId: orgId,
        userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
        phone: phone.replace(/^(\+254|0)/, '254'),
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
    // Validate that Daraja's checkout id matches what we stored — prevents spoofing.
    if (!payment || payment.checkoutRequestId !== input.checkoutRequestId) {
      throw new Error('Callback reference/checkout mismatch');
    }
    if (payment.status !== 'pending') return; // already finalized
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
            description: `M-Pesa top-up (${receipt ?? payment.checkoutRequestId ?? ''})`,
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
}
