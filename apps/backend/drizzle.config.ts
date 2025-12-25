// apps/backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// 明确从 apps/backend/.env 读取环境变量
dotenv.config({ path: '.env' });

export default defineConfig({
  // 这里指向我们统一导出的 schema（index.ts）
  schema: './src/db/schema/index.ts',

  // 迁移文件输出目录
  out: './drizzle',

  dialect: 'postgresql',

  dbCredentials: {
    // 使用 DATABASE_URL 连接 PostgreSQL
    // 确保在 apps/backend/.env 中有配置这一项
    url: process.env.DATABASE_URL as string,
  },
});