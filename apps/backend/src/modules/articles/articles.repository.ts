// apps/backend/src/modules/articles/articles.repository.ts
import { Injectable } from '@nestjs/common';
import {
  eq,
  desc,
  asc,
  and,
  or,
  like,
  sql,
  count,
} from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { articles, Article, NewArticle } from '../../db/schema';

// 后台列表用到的类型
type AdminStatus = 'draft' | 'published';
type AdminSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'publishedAt'
  | 'viewCount'
  | 'title';
type AdminSortOrder = 'asc' | 'desc';

@Injectable()
export class ArticlesRepository {
  constructor(private readonly db: DbService) {}

  /**
   * 前台：已发布文章列表
   * 置顶优先 + 发布时间 + 创建时间倒序
   */
  async findPublishedList(): Promise<Article[]> {
    const db = this.db.db;

    return db
      .select()
      .from(articles)
      .where(eq(articles.status, 'published'))
      .orderBy(
        desc(articles.isPinned),
        desc(articles.publishedAt),
        desc(articles.createdAt),
      );
  }

  /**
   * 根据 slug 查询单篇文章（前台详情用）
   */
  async findBySlug(slug: string): Promise<Article | null> {
    const db = this.db.db;

    const rows = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 后台：按 ID 查询
   */
  async findById(id: number): Promise<Article | null> {
    const db = this.db.db;

    const rows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 后台：获取文章列表（含搜索 + 排序 + 分页）
   *
   * 返回结构：{ items, total, page, pageSize }
   */
  async findAdminList(params: {
    q?: string;
    status?: AdminStatus;
    sortBy?: AdminSortBy;
    order?: AdminSortOrder;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Article[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const db = this.db.db;

    const {
      q,
      status,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      pageSize = 20,
    } = params;

    // 防御性兜底
    const allowedSortBy: AdminSortBy[] = [
      'createdAt',
      'updatedAt',
      'publishedAt',
      'viewCount',
      'title',
    ];
    const safeSortBy: AdminSortBy = allowedSortBy.includes(
      sortBy as AdminSortBy,
    )
      ? (sortBy as AdminSortBy)
      : 'createdAt';

    const safeOrder: AdminSortOrder =
      order === 'asc' || order === 'desc' ? order : 'desc';

    const pageNum = Math.max(1, page ?? 1);
    const pageSizeNum = Math.min(100, Math.max(1, pageSize ?? 20));
    const offset = (pageNum - 1) * pageSizeNum;

    // where 条件
    const whereParts = [];

    // 状态过滤
    if (status) {
      whereParts.push(eq(articles.status, status));
    }

    // 关键词：标题 / 摘要 / 正文 / slug
    if (q && q.trim() !== '') {
      const keyword = `%${q.trim()}%`;
      whereParts.push(
        or(
          like(articles.title, keyword),
          like(articles.summary, keyword),
          like(articles.content, keyword),
          like(articles.slug, keyword),
        ),
      );
    }

    const whereExpr =
      whereParts.length === 0
        ? undefined
        : whereParts.length === 1
          ? whereParts[0]
          : and(...whereParts);

    // 1）统计总数（这里不用中间变量，直接分支，避免 TS 报错）
    let total = 0;
    if (whereExpr) {
      const rows = await db
        .select({ value: count() })
        .from(articles)
        .where(whereExpr as any);
      total = Number(rows[0]?.value ?? 0);
    } else {
      const rows = await db
        .select({ value: count() })
        .from(articles);
      total = Number(rows[0]?.value ?? 0);
    }

    // 2）查询当前页数据
    const sortColumnMap: Record<AdminSortBy, any> = {
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
      viewCount: articles.viewCount,
      title: articles.title,
    };
    const sortColumn = sortColumnMap[safeSortBy] ?? articles.createdAt;
    const orderExpr =
      safeOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const baseSelect = db.select().from(articles);
    const selectWithWhere = whereExpr
      ? baseSelect.where(whereExpr as any)
      : baseSelect;

    const items = await selectWithWhere
      .orderBy(
        // 先按置顶
        desc(articles.isPinned),
        // 再按选中的排序字段
        orderExpr,
        // 最后兜底按创建时间倒序
        desc(articles.createdAt),
      )
      .limit(pageSizeNum)
      .offset(offset);

    return {
      items,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
    };
  }

  /**
   * 创建文章
   */
  async create(values: NewArticle): Promise<Article> {
    const db = this.db.db;

    const [row] = await db.insert(articles).values(values).returning();
    return row;
  }

  /**
   * 更新文章
   */
  async update(
    id: number,
    values: Partial<NewArticle>,
  ): Promise<Article | null> {
    const db = this.db.db;

    const [row] = await db
      .update(articles)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id))
      .returning();

    return row ?? null;
  }

  /**
   * 删除文章
   */
  async delete(id: number): Promise<void> {
    const db = this.db.db;
    await db.delete(articles).where(eq(articles.id, id));
  }

  /**
   * 浏览量 +1
   */
  async incrementViewCount(id: number): Promise<void> {
    const db = this.db.db;

    await db
      .update(articles)
      .set({
        viewCount: sql`${articles.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));
  }
}