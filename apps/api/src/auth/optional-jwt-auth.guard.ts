import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { appConfig } from '../config/configuration';

function rawApiKey(req: Request): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  return token && (token.startsWith('flk_live_') || token.startsWith('flk_test_')) ? token : null;
}

/**
 * Optional auth for public endpoints that become org-specific when a valid
 * JWT or API key is supplied. No token → req.user = null (public view).
 * Valid token → req.user populated (org-filtered view). Invalid token → 401.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload | null; apiKey?: unknown }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      req.user = null as unknown as JwtPayload;
      return true;
    }
    const apiKey = rawApiKey(req);
    if (apiKey) {
      const hashedKey = createHash('sha256').update(apiKey).digest('hex');
      const key = await this.prisma.client.apiKey.findUnique({ where: { hashedKey } });
      if (!key || key.revokedAt) {
        // Invalid API key when presented should be an auth error, not public.
        throw new (await import('@nestjs/common')).UnauthorizedException('Invalid or revoked API key');
      }
      void this.prisma.client.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      req.apiKey = { id: key.id, organizationId: key.organizationId, environment: key.environment };
      req.user = {
        sub: null as unknown as string,
        email: null as unknown as string,
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
      throw new (await import('@nestjs/common')).UnauthorizedException('Invalid or expired token');
    }
  }
}
