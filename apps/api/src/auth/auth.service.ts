import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync, compareSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Organization, User } from '@fleek/database';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
    if (!user || !compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { user, ...(await this.issueTokens(user)) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload & { typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: appConfig.jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Not a refresh token');

    const user = await this.prisma.client.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
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

  private async issueTokens(user: User): Promise<AuthTokens> {
    const base: Omit<JwtPayload, 'typ'> = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      isPlatformAdmin: user.isPlatformAdmin,
    };
    return {
      accessToken: await this.jwt.signAsync(base, {
        secret: appConfig.jwtSecret,
        expiresIn: appConfig.jwtExpiresIn,
      }),
      refreshToken: await this.jwt.signAsync({ ...base, typ: 'refresh' }, {
        secret: appConfig.jwtSecret,
        expiresIn: appConfig.refreshExpiresIn,
      }),
    };
  }

  audit(actorId: string | null, action: string, entity: string, entityId?: string) {
    return this.prisma.client.auditLog.create({
      data: { actorId, action, entity, entityId, actorType: actorId ? 'user' : 'system' },
    });
  }
}
