import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminController } from '../src/admin/admin.controller';
import type { JwtPayload } from '../src/auth/jwt-auth.guard';

const adminUser: JwtPayload = {
  sub: 'admin-1',
  email: 'admin@fleektech.co.ke',
  organizationId: 'org-admin',
  role: 'OWNER',
  isPlatformAdmin: true,
};

describe('AdminController.updateOrgPricingTier tenancy', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;
  let controller: AdminController;

  beforeEach(() => {
    client = {
      orgPricingTier: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = { client };
    controller = new AdminController(mockPrisma, {} as never, {} as never);
    client.orgPricingTier.update.mockImplementation(async (args: unknown) => args);
  });

  it("updates a tier that belongs to the URL's organization", async () => {
    // Emulate Prisma filtering: only org-a/tier-1 exists.
    client.orgPricingTier.findFirst.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) =>
        args.where.id === 'tier-1' && args.where.orgId === 'org-a'
          ? { id: 'tier-1', orgId: 'org-a' }
          : null,
    );
    const res = await controller.updateOrgPricingTier(adminUser, 'org-a', 'tier-1', {
      unitPriceMinor: 1500,
    });
    expect(res).toBeTruthy();
    expect(client.orgPricingTier.update).toHaveBeenCalledOnce();
  });

  it('refuses a tier UUID that belongs to a different organization', async () => {
    // tier-9 belongs to org-b, but the URL targets org-a → Prisma finds nothing.
    client.orgPricingTier.findFirst.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) =>
        args.where.id === 'tier-9' && args.where.orgId === 'org-b'
          ? { id: 'tier-9', orgId: 'org-b' }
          : null,
    );
    await expect(
      controller.updateOrgPricingTier(adminUser, 'org-a', 'tier-9', { unitPriceMinor: 1 }),
    ).rejects.toThrow();
    expect(client.orgPricingTier.update).not.toHaveBeenCalled();
  });
});
