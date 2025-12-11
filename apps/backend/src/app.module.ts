// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';        // ✅ 新增
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module'; // ✅ 预留（下一步会创建这个文件）
import { DbModule } from './db/db.module'; // ✅ 新增

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // 后面可以按你实际情况调整
    }),
    DbModule,     
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}