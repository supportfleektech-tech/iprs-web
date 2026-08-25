import {
  Inject,
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync, compareSync } from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Organization, User } from '@fleek/database';
import { PrismaService } from '../prisma/prisma.service';
import { MAILER, type Mailer } from '../common/mailer';
import { appConfig } from '../config/configuration';
import type { JwtPayload } from './jwt-auth.guard';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export class LoginBody {
  @IsEmail()
  email!: string;

  @IsString() @IsNotEmpty() @MinLength(8)
  password!: string;
}

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; org: Organization } & AuthTokens> {
    const exists = await this.prisma.client.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const result = await this.prisma.client.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.organizationName } });
      // Welcome credit lets new clients try the platform before their first invoice.
      const STARTING_CREDIT = BigInt(500_000); // KES 5,000 in minor units
      const wallet = await tx.wallet.create({
        data: { organizationId: org.id, balanceMinor: STARTING_CREDIT },
      });
      await tx.transaction.create({
        data: {
          type: 'topup',
          amountMinor: STARTING_CREDIT,
          balanceAfter: STARTING_CREDIT,
          description: 'Welcome credit',
          walletId: wallet.id,
        },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: hashSync(dto.password, 10),
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'OWNER',
          organizationId: org.id,
        },
      });
      return { org, user };
    });

    await this.audit(result.user.id, 'auth.register', 'organization', result.org.id);
    return { ...result, ...(await this.issueTokens(result.user)) };
  }

  async login(email: string, password: string): Promise<{ user: User } & AuthTokens> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Account temporarily locked. Try again in ${mins} minute(s).`);
    }

    if (!user || !compareSync(password, user.passwordHash)) {
      if (user) await this.registerFailedAttempt(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    return { user, ...(await this.issueTokens(user)) };
  }

  /**
   * Single-use refresh tokens: each call revokes the presented token and
   * issues a fresh pair. Presenting an already-revoked token is treated as
   * theft — every active session for that user is revoked immediately.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.client.refreshToken.findUnique({
      where: { hashedToken: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      await this.revokeAllSessions(stored.userId, 'refresh-token-reuse');
      throw new UnauthorizedException('Refresh token expired or reused — all sessions revoked');
    }

    const next = await this.issueTokens(stored.user, stored.id);
    return next;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { hashedToken: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Always returns success — never reveals whether the email exists. */
  async requestPasswordReset(
    email: string,
  ): Promise<{ ok: true; devResetToken?: string }> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) return { ok: true };

    const raw = randomBytes(32).toString('hex');
    await this.prisma.client.passwordResetToken.create({
      data: {
        userId: user.id,
        hashedToken: hashToken(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });

    const link = `${process.env.PASSWORD_RESET_URL ?? 'http://localhost:3001/reset-password'}?token=${raw}`;
    await this.mailer.send(user.email, 'Reset your Fleek IPRS password', `Reset link (valid 1 hour): ${link}`);

    // Dev/test affordance so the full flow is verifiable without an inbox.
    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, devResetToken: raw };
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.prisma.client.passwordResetToken.findUnique({
      where: { hashedToken: hashToken(rawToken) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: hashSync(newPassword, 10),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.client.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Password changed → treat all existing sessions as compromised.
    await this.revokeAllSessions(record.userId, 'password-reset');
    await this.audit(record.userId, 'auth.reset_password', 'user', record.userId);
  }

  async createApiKey(orgId: string, name: string, environment: 'live' | 'test') {
    const raw = `flk_${environment}_${randomBytes(24).toString('hex')}`;
    const hashedKey = createHash('sha256').update(raw).digest('hex');
    const key = await this.prisma.client.apiKey.create({
      data: { name, environment, hashedKey, prefix: raw.slice(0, 13), organizationId: orgId },
    });
    await this.audit(null, 'apikey.create', 'api_key', key.id);
    // The raw key is shown exactly once.
    return { id: key.id, name: key.name, environment: key.environment, key: raw };
  }

  async listApiKeys(orgId: string) {
    return this.prisma.client.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, name: true, prefix: true, environment: true,
        lastUsedAt: true, revokedAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(orgId: string, keyId: string) {
    const key = await this.prisma.client.apiKey.findFirst({ where: { id: keyId, organizationId: orgId } });
    if (!key) throw new BadRequestException('API key not found');
    return this.prisma.client.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  }

  private async issueTokens(user: User, rotatingFromId?: string): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'typ'> & Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: appConfig.jwtSecret,
      expiresIn: appConfig.jwtExpiresIn,
    });

    const rawRefresh = randomBytes(48).toString('base64url');
    const created = await this.prisma.client.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + ms(appConfig.refreshExpiresIn)),
        rotatedToId: rotatingFromId ?? null,
      },
    });

    if (rotatingFromId) {
      await this.prisma.client.refreshToken.update({
        where: { id: rotatingFromId },
        data: { revokedAt: new Date(), rotatedToId: created.id },
      });
    }

    return { accessToken, refreshToken: rawRefresh };
  }

  private async registerFailedAttempt(userId: string, currentFailures: number) {
    const failures = currentFailures + 1;
    const shouldLock = failures >= MAX_FAILED_LOGINS;
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: failures,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    await this.audit(
      userId,
      shouldLock ? 'auth.locked_out' : 'auth.failed_login',
      'user',
      userId,
    );
  }

  private revokeAllSessions(userId: string, reason: string) {
    return this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }).then(() => this.audit(null, `auth.sessions_revoked:${reason}`, 'user', userId));
  }

  audit(actorId: string | null, action: string, entity: string, entityId?: string) {
    return this.prisma.client.auditLog.create({
      data: { actorId, action, entity, entityId, actorType: actorId ? 'user' : 'system' },
    });
  }
}

/** Supports "15m"/"7d" style durations without pulling a date library. */
function ms(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 7 * 86_400_000;
  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 's': return value * 1000;
    case 'm': return value * 60_000;
    case 'h': return value * 3_600_000;
    default: return value * 86_400_000;
  }
}
