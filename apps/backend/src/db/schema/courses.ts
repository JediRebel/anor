// apps/backend/src/db/schema/courses.ts

import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const courseStatusEnum = pgEnum('course_status', ['draft', 'published']);
export const courseAccessTypeEnum = pgEnum('course_access_type', [
  'free',
  'paid',
]);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    title: text('title').notNull(),
    slug: text('slug').notNull(), // URL 标识，如 "ee-101"
    summary: text('summary'), // 列表页短摘要
    description: text('description'), // 详情页长描述（先用纯文本即可）
    coverImageUrl: text('cover_image_url'),
    // 课程访问控制：免费/付费（用于“免费课程列表 + 加入课程/退出学习”）
    accessType: courseAccessTypeEnum('access_type').notNull().default('paid'),
    // 价格（分）；免费课程为 0。后续可在业务层对 paid 强制 > 0。
    priceCents: integer('price_cents').notNull().default(0),

    status: courseStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('courses_slug_unique').on(t.slug),
  }),
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
