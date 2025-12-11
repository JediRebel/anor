// apps/backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 读取 apps/backend/.env
dotenv.config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema/*', // 等会儿我们会在这里放 users 等表结构
  out: './drizzle',            // 迁移文件输出目录（apps/backend/drizzle）
  dialect: 'postgresql',
  dbCredentials: {
    // 这里假定 DATABASE_URL 一定存在（!）
    url: process.env.DATABASE_URL as string,
  },
});