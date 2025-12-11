// apps/backend/src/db/schema/users.ts
import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';

// 用户角色枚举：只包含真正有账号的角色
// 未登录的 guest 只是前端概念，不需要写进数据库
export const userRoleEnum = pgEnum('user_role', ['user', 'paid_user', 'admin']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),

  // 邮箱：唯一且必填
  email: varchar('email', { length: 255 }).notNull().unique(),

  // 密码哈希（例如 bcrypt.hash 之后的字符串）
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  // 用户角色，默认是普通用户
  role: userRoleEnum('role').notNull().default('user'),

  // 是否启用账号（禁用时可以直接用这个字段做控制）
  isActive: boolean('is_active').notNull().default(true),

  // 创建时间
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  // 更新时间
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  // 最近一次登录时间（后面登录成功时在 Service 里更新）
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];