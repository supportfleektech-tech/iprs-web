import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { ApiKey } from '@fleek/database';
import type { JwtPayload } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { appConfig } from '../config/configuration';

function rawApiKey(req: Request): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  return token && (token.startsWith('flk_live_') || token.startsWith('flk_test_')) ? token : null;
}

async function validateApiKey(
  prisma: PrismaService,
  raw: string,
): Promise<ApiKey> {
  const hashedKey = createHash('sha256').update(raw).digest('hex');
  const key = await prisma.client.apiKey.findUnique({ where: { hashedKey } });
  if (!key || key.revokedAt) throw new UnauthorizedException('Invalid or revoked API key');
  void prisma.client.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return key;
}

/** Authenticates machine clients via `Authorization: Bearer flk_live_…` / `flk_test_…`. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = rawApiKey(req);
    if (!raw) throw new UnauthorizedException('Missing API key');

    const key = await validateApiKey(this.prisma, raw);
    req.apiKey = { id: key.id, organizationId: key.organizationId, environment: key.environment };
    req.user = {
      sub: null,
      email: null,
      organizationId: key.organizationId,
      role: 'API',
      isPlatformAdmin: false,
    };
    return true;
  }
}

/**
 * Accepts either a dashboard JWT session or a machine API key on the same
 * route. Normalizes both into `req.user`; attaches `req.apiKey` when present.
 */
@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Provide a bearer token or API key');

    const apiKey = rawApiKey(req);
    if (apiKey) {
      const key = await validateApiKey(this.prisma, apiKey);
      req.apiKey = { id: key.id, organizationId: key.organizationId, environment: key.environment };
      req.user = {
        sub: null,
        email: null,
        organizationId: key.organizationId,
        role: 'API',
        isPlatformAdmin: false,
      };
      return true;
    }

    try {
      req.user = await this.jwt.verifyAsync<JwtPayload & object>(token, {
        secret: appConfig.jwtSecret,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
