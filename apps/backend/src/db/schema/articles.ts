// apps/backend/src/db/schema/articles.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * Category：文章分类
 */
export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugUniqueIdx: uniqueIndex('categories_slug_unique').on(table.slug),
    sortOrderIdx: index('categories_sort_order_idx').on(table.sortOrder),
  }),
);

/**
 * Tag：文章标签
 */
export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugUniqueIdx: uniqueIndex('tags_slug_unique').on(table.slug),
  }),
);

/**
 * Article：文章 / 移民资讯
 */
export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),

    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),

    summary: varchar('summary', { length: 500 }),
    content: text('content').notNull(),
    coverImageUrl: varchar('cover_image_url', { length: 512 }),

    // draft / published / archived
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    isPinned: boolean('is_pinned').notNull().default(false),

    viewCount: integer('view_count').notNull().default(0),

    // 可为 null，因此不需要 .notNull()，也不需要 .nullable()
    categoryId: integer('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),

    // 作者也可以为空（例如导入的旧文章）
    authorId: integer('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    slugUniqueIdx: uniqueIndex('articles_slug_unique').on(table.slug),
    categoryIdx: index('articles_category_id_idx').on(table.categoryId),
    statusIdx: index('articles_status_idx').on(table.status),
    publishedAtIdx: index('articles_published_at_idx').on(table.publishedAt),
    authorIdx: index('articles_author_id_idx').on(table.authorId),
  }),
);

/**
 * ArticleTag：文章 - 标签 多对多关系表
 */
export const articleTags = pgTable(
  'article_tags',
  {
    articleId: integer('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({
      name: 'article_tags_pkey',
      columns: [table.articleId, table.tagId],
    }),
    articleIdx: index('article_tags_article_id_idx').on(table.articleId),
    tagIdx: index('article_tags_tag_id_idx').on(table.tagId),
  }),
);

// TypeScript 类型（可选）
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
