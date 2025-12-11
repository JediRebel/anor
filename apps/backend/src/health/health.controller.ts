// apps/backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  getHealth() {
    const env = this.configService.get<string>('NODE_ENV') ?? 'development';
    const port = this.configService.get<string>('BACKEND_PORT') ?? 'unknown';

    return {
      status: 'ok',
      env,
      port,
      timestamp: new Date().toISOString(),
    };
  }
}