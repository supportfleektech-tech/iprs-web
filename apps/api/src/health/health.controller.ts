import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. No dependency checks. */
  @Get()
  check() {
    return { status: 'ok', service: 'fleek-iprs-api', time: new Date().toISOString() };
  }

  /** Readiness: the process can serve traffic (database reachable). */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'fleek-iprs-api',
        database: 'up',
        time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
  }
}
