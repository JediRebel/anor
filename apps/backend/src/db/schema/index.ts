// apps/backend/src/db/schema/index.ts

import { users } from './users';
import { courses, courseStatusEnum, courseAccessTypeEnum } from './courses';
import { lessons, lessonStatusEnum, lessonTypeEnum } from './lessons';
import { enrollments } from './enrollments';
// 注意：articles 暂时保持原来的导出方式，因为你还没有在 articles.ts 里定义 pgEnum
import { categories, tags, articles, articleTags } from './articles';

// 1）导出各个表和 Enum
export {
  users,
  courses,
  courseStatusEnum,
  courseAccessTypeEnum,
  lessons,
  lessonStatusEnum,
  lessonTypeEnum,
  enrollments,
  categories,
  tags,
  articles,
  articleTags,
};

// 2）统一导出的 schema 对象
export const schema = {
  users,
  courses,
  // Drizzle 其实不需要把 enum 放入 schema 对象中也能工作，
  // 但如果有 relations 定义，必须放进来。
  lessons,
  enrollments,
  categories,
  tags,
  articles,
  articleTags,
};

// 3）TypeScript 类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
