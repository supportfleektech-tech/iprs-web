import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { compareSync, hashSync } from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    email: 'a@b.co',
    passwordHash: hashSync('CorrectHorse1!', 4),
    firstName: 'A',
    lastName: 'B',
    role: 'OWNER',
    isPlatformAdmin: false,
    organizationId: 'org1',
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

function makeDeps() {
  const client = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rt-new', ...data })),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    organization: { create: vi.fn() },
    wallet: { create: vi.fn() },
    transaction: { create: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    apiKey: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  const prisma = { client, encrypt: (v: string) => `enc:${v}`, decrypt: (v: string) => v } as never;
  const jwt = { signAsync: vi.fn().mockResolvedValue('jwt-token'), verifyAsync: vi.fn() } as never;
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };

  return { service: new AuthService(prisma, jwt, mailer), client, mailer };
}

describe('login throttling', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
    vi.useFakeTimers();
  });

  it('locks the account after 5 consecutive failures', async () => {
    // Stateful fake: update() persists so consecutive failures accumulate.
    const user = makeUser();
    deps.client.user.findUnique.mockImplementation(() => Promise.resolve(user));
    deps.client.user.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      Object.assign(user, data);
      return Promise.resolve({});
    });

    // 4 failures → still generic invalid credentials, no lock
    for (let i = 0; i < 4; i++) {
      await expect(deps.service.login(user.email, 'wrongpass1')).rejects.toThrow(
        'Invalid credentials',
      );
    }
    expect(user.failedLoginAttempts).toBe(4);
    expect(user.lockedUntil).toBeNull();

    // 5th failure → lock set
    await expect(deps.service.login(user.email, 'wrongpass1')).rejects.toThrow(
      'Invalid credentials',
    );
    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);
  });

  it('rejects a locked account before checking the password', async () => {
    const future = new Date(Date.now() + 10 * 60_000);
    deps.client.user.findUnique.mockResolvedValue(makeUser({ lockedUntil: future }));

    await expect(deps.service.login('a@b.co', 'anything8')).rejects.toThrow(/locked/i);
    expect(deps.client.user.update).not.toHaveBeenCalled();
  });

  it('resets failure counter on successful login', async () => {
    deps.client.user.findUnique.mockResolvedValue(makeUser({ failedLoginAttempts: 3 }));
    await deps.service.login('a@b.co', 'CorrectHorse1!');
    const update = deps.client.user.update.mock.calls[0][0];
    expect(update.data.failedLoginAttempts).toBe(0);
    expect(update.data.lockedUntil).toBeNull();
  });
});

describe('refresh token rotation', () => {
  it('rotates: revokes old token and issues a fresh one', async () => {
    const { service, client } = makeDeps();
    client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-old',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user: makeUser(),
    });

    const tokens = await service.refresh('some-opaque-token');

    expect(tokens.accessToken).toBe('jwt-token');
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.refreshToken.length).toBeGreaterThan(20);

    // Old token revoked, linked to its successor
    const revoke = client.refreshToken.update.mock.calls.find((c) => c[0].where.id === 'rt-old');
    expect(revoke).toBeTruthy();
    expect(revoke![0].data.revokedAt).toBeInstanceOf(Date);
  });

  it('treats reuse of a revoked token as theft: revokes all sessions', async () => {
    const { service, client } = makeDeps();
    client.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-used',
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      user: makeUser(),
    });

    await expect(service.refresh('stolen-token')).rejects.toThrow(UnauthorizedException);
    expect(client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects unknown refresh tokens', async () => {
    const { service, client } = makeDeps();
    client.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('garbage')).rejects.toThrow(UnauthorizedException);
  });
});

describe('password reset', () => {
  it('marks used/expired tokens invalid', async () => {
    const { service, client } = makeDeps();
    client.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt1',
      userId: 'u1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(service.resetPassword('tok', 'NewPassword1!')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updates the password, consumes the token and revokes all sessions', async () => {
    const { service, client } = makeDeps();
    client.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    client.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));

    const capturedHashes: string[] = [];
    client.user.update.mockImplementation(({ data }: { data: { passwordHash: string } }) => {
      capturedHashes.push(data.passwordHash);
      return Promise.resolve({});
    });

    await service.resetPassword('valid-token', 'NewPassword1!');

    expect(capturedHashes).toHaveLength(1);
    expect(compareSync('NewPassword1!', capturedHashes[0]!)).toBe(true);
    expect(client.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'prt1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(client.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('forgot-password is silent for unknown emails but sends for real ones', async () => {
    const { service, client, mailer } = makeDeps();

    client.user.findUnique.mockResolvedValueOnce(null);
    await service.requestPasswordReset('nobody@x.co');
    expect(mailer.send).not.toHaveBeenCalled();
    expect(client.passwordResetToken.create).not.toHaveBeenCalled();

    client.user.findUnique.mockResolvedValueOnce(makeUser());
    await service.requestPasswordReset('a@b.co');
    expect(client.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const [, subject] = mailer.send.mock.calls[0]!;
    expect(subject).toMatch(/reset/i);
  });
});
