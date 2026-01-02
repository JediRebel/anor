// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CoursesModule } from './modules/courses/courses.module';
import { MeModule } from './modules/me/me.module';
// 新增引入 ToolsModule
import { ToolsModule } from './modules/tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 优先读取本地 .env.local，其次是 .env
      envFilePath: ['.env.local', '.env'],
    }),
    // 静态资源服务：确保上传的图片可以通过 URL 访问
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
    HealthModule,
    DbModule,
    AuthModule,
    ArticlesModule,
    UploadsModule,
    CoursesModule,
    MeModule,
    // 注册 Phase 7 新模块
    ToolsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
