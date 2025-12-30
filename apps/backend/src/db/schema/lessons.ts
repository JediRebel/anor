// apps/backend/src/db/schema/lessons.ts

import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
// 修正这里：必须是相对路径，直接指向 courses.ts
import { courses } from './courses';

export const lessonStatusEnum = pgEnum('lesson_status', ['draft', 'published']);
export const lessonTypeEnum = pgEnum('lesson_type', ['video', 'text']);

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    slug: text('slug').notNull(), // 同一课程内唯一

    order: integer('order').notNull(), // 课节顺序：1,2,3...

    type: lessonTypeEnum('type').notNull().default('video'),

    // 二选一：视频/文本
    videoUrl: text('video_url'),
    contentText: text('content_text'),

    isFreePreview: boolean('is_free_preview').notNull().default(false),

    status: lessonStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // 同一 course 下 slug 唯一
    courseSlugUnique: uniqueIndex('lessons_course_slug_unique').on(
      t.courseId,
      t.slug,
    ),
    // 同一 course 下 order 唯一
    courseOrderUnique: uniqueIndex('lessons_course_order_unique').on(
      t.courseId,
      t.order,
    ),
  }),
);

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
