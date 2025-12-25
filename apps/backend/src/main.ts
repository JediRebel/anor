// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestLoggingInterceptor } from './common/logging.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // 为后面日志做准备，可留着
  });

  // 全局参数校验：后面 Controller 用 DTO 时会自动生效
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 只保留 DTO 中声明的字段
      forbidNonWhitelisted: true, // 出现多余字段直接报错
      transform: true, // 自动类型转换（字符串 -> number 等）
    }),
  );
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter()); // ✅ 全局异常过滤器
  // 静态资源：暴露 apps/backend/public 目录，便于访问上传的封面图等文件
  app.useStaticAssets(join(__dirname, '..', 'public'));
  // 从 ConfigService 读取 BACKEND_PORT（由 apps/backend/.env 提供）
  const configService = app.get(ConfigService);
  const port = configService.get<number>('BACKEND_PORT') ?? 4000;

  // 这里开启 CORS，允许前端开发地址访问
  app.enableCors({
    origin: 'http://localhost:3100', // 前端 dev 的地址
    credentials: true,
  });

  await app.listen(port);
  console.log(`Backend is running on http://localhost:${port}`);
}
bootstrap();
