// apps/backend/src/health/health.controller.ts
import { Controller, Get, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../db/db.module';
import { users } from '../db/schema';

@Controller()
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: DbService,
  ) {}

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

  @Get('health/db')
  async getHealthDb() {
    // 简单查一下 users 表，验证数据库连接
    const sample = await this.dbService.db.select().from(users).limit(1);

    return {
      status: 'ok',
      db: 'connected',
      sampleUser: sample[0] ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/error')
  getHealthError() {
    // 故意抛出一个 400 错误，用来测试全局异常过滤器
    throw new BadRequestException('Test error from /health/error');
  }
}


  