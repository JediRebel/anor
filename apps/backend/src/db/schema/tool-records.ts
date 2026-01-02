import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const toolRecords = pgTable('tool_records', {
  id: serial('id').primaryKey(),

  // 关联用户表，必须是登录用户才能保存
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  // 工具类型：'ee-score' | 'path-selector'
  toolType: varchar('tool_type', { length: 50 }).notNull(),

  // 输入参数（例如：年龄、雅思分数等），存为 JSON
  inputPayload: jsonb('input_payload').notNull(),

  // 计算结果（例如：总分 450），存为 JSON
  resultPayload: jsonb('result_payload').notNull(),

  // 创建时间
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
