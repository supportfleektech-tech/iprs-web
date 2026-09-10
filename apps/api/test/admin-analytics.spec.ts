import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminService } from '../src/admin/admin.service';

describe('AdminService.analytics', () => {
  let service: AdminService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      client: {
        verificationRequest: {
          findMany: vi.fn(),
        },
      },
      encrypt: vi.fn((v: string) => v),
      decrypt: vi.fn((v: string) => v),
    };
    service = new AdminService(mockPrisma);
  });

  it('aggregates status/product counts, cost totals, latency averages without PII', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([
      { type: 'iprs_standard', status: 'success', costMinor: 3000n, latencyMs: 100, createdAt: new Date('2026-09-01') },
      { type: 'iprs_standard', status: 'success', costMinor: 3000n, latencyMs: 200, createdAt: new Date('2026-09-02') },
      { type: 'kra_pin_verification', status: 'failed', costMinor: 0n, latencyMs: 150, createdAt: new Date('2026-09-03') },
    ]);
    const res = await service.analytics('org-1', {});
    expect(res.totals.verifications).toBe(3);
    expect(res.totals.cost).toBe(60);
    expect(res.totals.avgLatencyMs).toBe(150);
    expect(res.statusCounts).toEqual({ success: 2, failed: 1 });
    expect(res.productCounts).toEqual({ iprs_standard: 2, kra_pin_verification: 1 });
    expect(res.costByProduct).toEqual({ iprs_standard: 60, kra_pin_verification: 0 });
    expect(res.truncated).toBe(false);
    // PII exclusion — select must not include encrypted fields
    const call = mockPrisma.client.verificationRequest.findMany.mock.calls[0][0];
    expect(call.select).not.toHaveProperty('encryptedInput');
    expect(call.select).not.toHaveProperty('encryptedResult');
    expect(call.select).not.toHaveProperty('result');
    // Bounded limit
    expect(call.take).toBe(10000);
  });

  it('applies date range and type/status filters server-side', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    await service.analytics('org-1', { from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T23:59:59.000Z', type: 'iprs_standard', status: 'success' });
    const where = mockPrisma.client.verificationRequest.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('iprs_standard');
    expect(where.status).toBe('success');
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    expect(String(where.organizationId)).toBe('org-1');
    expect(where).not.toHaveProperty('encryptedInput');
  });

  it('ignores invalid type/status and keeps date out on bad parse', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    await service.analytics(undefined, { from: 'bad-date', type: 'not_a_type', status: 'weird' });
    const where = mockPrisma.client.verificationRequest.findMany.mock.calls[0][0].where;
    expect(where.type).toBeUndefined();
    expect(where.status).toBeUndefined();
    expect(where.createdAt).toBeUndefined();
    expect(where.organizationId).toBeUndefined();
  });

  it('returns empty counts and null latency when no rows', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    const res = await service.analytics('org-1', {});
    expect(res.totals.verifications).toBe(0);
    expect(res.totals.cost).toBe(0);
    expect(res.totals.avgLatencyMs).toBeNull();
    expect(res.statusCounts).toEqual({});
    expect(res.productCounts).toEqual({});
    expect(res.truncated).toBe(false);
  });

  it('excludes non-finite latencies from average', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([
      { type: 'a', status: 'success', costMinor: 0n, latencyMs: null, createdAt: new Date() },
      { type: 'a', status: 'success', costMinor: 0n, latencyMs: 80, createdAt: new Date() },
    ]);
    const res = await service.analytics('org-1', {});
    expect(res.totals.avgLatencyMs).toBe(80);
  });

  it('applies search filter with OR on id/source/type/status', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    await service.analytics('org-1', { search: 'iprs' });
    const where = mockPrisma.client.verificationRequest.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
    // Should contain id and source contains
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.objectContaining({ contains: 'iprs' }) }),
        expect.objectContaining({ source: expect.objectContaining({ contains: 'iprs' }) }),
      ]),
    );
    // Should also match type iprs_standard
    expect(where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ type: expect.objectContaining({ in: expect.arrayContaining(['iprs_standard']) }) })]));
  });

  it('applies search for status term', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    await service.analytics('org-1', { search: 'success' });
    const where = mockPrisma.client.verificationRequest.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ status: expect.objectContaining({ in: expect.arrayContaining(['success']) }) })]));
  });

  it('rejects inverted date range (from > to) with 400', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([]);
    await expect(service.analytics('org-1', { from: '2026-09-30T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' })).rejects.toThrow('from must be <= to');
    expect(mockPrisma.client.verificationRequest.findMany).not.toHaveBeenCalled();
  });

  it('sets truncated true when hitting 10k limit', async () => {
    const rows = Array.from({ length: 10000 }, () => ({ type: 'iprs_standard', status: 'success', costMinor: 100n, latencyMs: 10, createdAt: new Date() }));
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue(rows);
    const res = await service.analytics('org-1', {});
    expect(res.truncated).toBe(true);
    expect(res.totals.verifications).toBe(10000);
    // cost: 100 *10000 = 1_000_000 minor => 10000 KES
    expect(res.totals.cost).toBe(10000);
  });

  it('uses BigInt sum for costByProduct (single BigInt path)', async () => {
    mockPrisma.client.verificationRequest.findMany.mockResolvedValue([
      { type: 'iprs_standard', status: 'success', costMinor: 199n, latencyMs: 10, createdAt: new Date() },
      { type: 'iprs_standard', status: 'success', costMinor: 201n, latencyMs: 10, createdAt: new Date() },
    ]);
    const res = await service.analytics('org-1', {});
    // 199+201=400 minor => 4.00 KES
    expect(res.costByProduct['iprs_standard']).toBe(4);
    expect(res.totals.cost).toBe(4);
  });
});
