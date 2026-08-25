import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'fleek-iprs-api', time: new Date().toISOString() };
  }
}
