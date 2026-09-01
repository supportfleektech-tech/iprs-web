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
 *   - Card (future: Pesapal/Stripe)
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
      default:
        return `Wallet top-up (${reference})`;
    }
  }
}