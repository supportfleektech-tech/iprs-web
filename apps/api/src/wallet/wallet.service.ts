import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0];

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(orgId: string) {
    const wallet = await this.prisma.client.wallet.findUnique({
      where: { organizationId: orgId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return {
      balance: Number(wallet.balanceMinor) / 100,
      currency: wallet.currency,
    };
  }

  async getTransactions(orgId: string, limit = 50, offset = 0) {
    const where = { wallet: { organizationId: orgId } };
    const [items, total] = await Promise.all([
      this.prisma.client.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      this.prisma.client.transaction.count({ where }),
    ]);
    return {
      total,
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amountMinor) / 100,
        balanceAfter: Number(t.balanceAfter) / 100,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /** Client requests a credit top-up; an admin approves it later. */
  async requestTopUp(orgId: string, userId: string, amountKes: number) {
    if (!Number.isFinite(amountKes) || amountKes < 1000) {
      throw new BadRequestException('Minimum top-up is KES 1,000');
    }
    return this.prisma.client.topUpRequest.create({
      data: {
        organizationId: orgId,
        requestedById: userId,
        amountMinor: BigInt(Math.round(amountKes * 100)),
      },
    });
  }

  async listTopUps(orgId?: string, status?: 'pending' | 'approved' | 'rejected') {
    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(status ? { status } : {}),
    };
    return this.prisma.client.topUpRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });
  }

  /**
   * Admin approval credits the wallet and writes the ledger entry atomically.
   * Non-platform admins may only review requests belonging to their own org.
   */
  async reviewTopUp(
    topUpId: string,
    adminId: string,
    approve: boolean,
    note?: string,
    orgScope?: string,
  ) {
    return this.prisma.client.$transaction(async (tx: Tx) => {
      const topUp = await tx.topUpRequest.findUnique({ where: { id: topUpId } });
      if (!topUp) throw new NotFoundException('Top-up request not found');
      if (topUp.status !== 'pending') throw new BadRequestException('Already reviewed');
      if (orgScope && topUp.organizationId !== orgScope) {
        throw new BadRequestException('Not allowed to review this request');
      }

      await tx.topUpRequest.update({
        where: { id: topUpId },
        data: { status: approve ? 'approved' : 'rejected', reviewedById: adminId, reviewedAt: new Date(), adminNote: note },
      });

      if (approve) {
        await this.credit(tx, topUp.organizationId, topUp.amountMinor, `Invoice top-up approved (${topUpId})`);
      }
      return { id: topUpId, approved: approve };
    });
  }

  /** Credits inside a transaction; creates ledger row with running balance. */
  private async credit(tx: Tx, orgId: string, amountMinor: bigint, description: string) {
    const wallet = await tx.wallet.upsert({
      where: { organizationId: orgId },
      update: { balanceMinor: { increment: amountMinor } },
      create: { organizationId: orgId, balanceMinor: amountMinor },
    });
    await tx.transaction.create({
      data: {
        type: 'topup',
        amountMinor,
        balanceAfter: wallet.balanceMinor,
        description,
        walletId: wallet.id,
      },
    });
  }
}
