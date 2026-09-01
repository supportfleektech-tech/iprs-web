import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '../src/wallet/wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      client: {
        wallet: {
          findUnique: vi.fn(),
          update: vi.fn(),
          upsert: vi.fn(),
        },
        transaction: {
          create: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
        },
        topUpRequest: {
          create: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        $transaction: vi.fn(async (callback) => callback(mockPrisma.client)),
      },
    };
    service = new WalletService(mockPrisma);
  });

  describe('getBalance', () => {
    it('should return balance in KES', async () => {
      mockPrisma.client.wallet.findUnique.mockResolvedValue({
        balanceMinor: 500000n,
        currency: 'KES',
      });

      const balance = await service.getBalance('org-1');
      expect(balance.balance).toBe(5000);
      expect(balance.currency).toBe('KES');
    });

    it('should throw NotFoundException if wallet not found', async () => {
      mockPrisma.client.wallet.findUnique.mockResolvedValue(null);
      await expect(service.getBalance('org-1')).rejects.toThrow('Wallet not found');
    });
  });

  describe('getTransactions', () => {
    it('should return transactions with pagination', async () => {
      mockPrisma.client.transaction.findMany.mockResolvedValue([
        { id: '1', type: 'topup', amountMinor: 100000n, balanceAfter: 500000n, description: 'Welcome', createdAt: new Date() },
      ]);
      mockPrisma.client.transaction.count.mockResolvedValue(1);

      const result = await service.getTransactions('org-1', 10, 0);
      expect(result.total).toBe(1);
      expect(result.items[0].amount).toBe(1000);
      expect(result.items[0].type).toBe('topup');
    });
  });

  describe('requestTopUp', () => {
    it('should create top-up request', async () => {
      mockPrisma.client.topUpRequest.create.mockResolvedValue({
        id: 'topup-1',
        amountMinor: 500000n,
        status: 'pending',
      });

      const result = await service.requestTopUp('org-1', 'user-1', 5000);
      expect(result.amountMinor).toBe(500000n);
      expect(result.status).toBe('pending');
    });

    it('should throw BadRequestException for amount < 1000', async () => {
      await expect(service.requestTopUp('org-1', 'user-1', 500)).rejects.toThrow('Minimum top-up is KES 1,000');
    });
  });

  describe('reviewTopUp', () => {
    it('should approve top-up and credit wallet', async () => {
      mockPrisma.client.topUpRequest.findUnique.mockResolvedValue({
        id: 'topup-1',
        organizationId: 'org-1',
        amountMinor: 500000n,
        status: 'pending',
      });
      mockPrisma.client.topUpRequest.update.mockResolvedValue({});
      mockPrisma.client.wallet.upsert.mockResolvedValue({ balanceMinor: 1000000n });
      mockPrisma.client.transaction.create.mockResolvedValue({});

      const result = await service.reviewTopUp('topup-1', 'admin-1', true, 'Approved');
      expect(result.approved).toBe(true);
    });

    it('should throw if already reviewed', async () => {
      mockPrisma.client.topUpRequest.findUnique.mockResolvedValue({
        id: 'topup-1',
        status: 'approved',
      });
      await expect(service.reviewTopUp('topup-1', 'admin-1', true)).rejects.toThrow('Already reviewed');
    });

    it('should enforce org scope for non-platform admins', async () => {
      mockPrisma.client.topUpRequest.findUnique.mockResolvedValue({
        id: 'topup-1',
        organizationId: 'org-2',
        status: 'pending',
      });
      await expect(service.reviewTopUp('topup-1', 'admin-1', true, undefined, 'org-1')).rejects.toThrow('Not allowed to review this request');
    });
  });
});