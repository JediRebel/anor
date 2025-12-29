import { users } from './users';
import { courses } from './courses';
import { lessons } from './lessons';
import { enrollments } from './enrollments';
import { categories, tags, articles, articleTags } from './articles';

// 1）导出各个表本身，方便其他地方直接按表引用
export {
  users,
  courses,
  lessons,
  enrollments,
  categories,
  tags,
  articles,
  articleTags,
};

// 2）统一导出的 schema 对象，给 drizzle 实例和迁移用
export const schema = {
  users,
  courses,
  lessons,
  enrollments,
  categories,
  tags,
  articles,
  articleTags,
};

// 3）TypeScript 类型（基于 $inferSelect / $inferInsert）

// User
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Category
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// Tag
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

// Article
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

// Course
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

// Lesson
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

// Enrollment
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
