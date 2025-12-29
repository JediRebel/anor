// apps/backend/src/db/schema/enrollments.ts
import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';
import { users } from './users';

export const enrollmentSourceEnum = pgEnum('enrollment_source', [
  'admin_grant',
  'manual',
]);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),

    source: enrollmentSourceEnum('source').notNull().default('manual'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userCourseUnique: uniqueIndex('enrollments_user_course_unique').on(
      t.userId,
      t.courseId,
    ),
  }),
);

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
