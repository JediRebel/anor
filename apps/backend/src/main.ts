// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestLoggingInterceptor } from './common/logging.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
// import { join } from 'path'; // 不再需要

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // 解析 Cookie
  app.use((req: any, _res: any, next: any) => {
    const header = req?.headers?.cookie;
    const cookies: Record<string, string> = {};

    if (typeof header === 'string' && header.length) {
      for (const part of header.split(';')) {
        const [rawKey, ...rest] = part.split('=');
        const key = rawKey?.trim();
        if (!key) continue;
        const value = rest.join('=');
        cookies[key] = decodeURIComponent((value ?? '').trim());
      }
    }

    req.cookies = cookies;
    next();
  });

  // 全局校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // ❌ 移除：app.useStaticAssets(join(__dirname, '..', 'public'));
  // 已在 AppModule 中通过 ServeStaticModule 统一配置

  const configService = app.get(ConfigService);
  const port = configService.get<number>('BACKEND_PORT') ?? 4000;

  app.enableCors({
    origin: 'http://localhost:3100',
    credentials: true,
  });

  await app.listen(port);
  console.log(`Backend is running on http://localhost:${port}`);
}
bootstrap();
