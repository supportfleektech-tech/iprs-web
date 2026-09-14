import { describe, it, expect, vi } from 'vitest';
import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('liveness (/v1/health) reports ok without touching the database', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controller = new HealthController({} as any);
    const res = controller.check();
    expect(res.status).toBe('ok');
  });

  it('readiness (/v1/health/ready) reports ok when the database answers', async () => {
    const controller = new HealthController({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
    } as never);
    const res = await controller.ready();
    expect(res.status).toBe('ok');
    expect(res.database).toBe('up');
  });

  it('readiness fails with 503 when the database is unreachable', async () => {
    const controller = new HealthController({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: { $queryRaw: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) },
    } as never);
    await expect(controller.ready()).rejects.toMatchObject({ status: 503 });
  });
});
