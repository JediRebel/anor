// apps/backend/src/modules/articles/articles.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArticlesRepository } from './articles.repository';
import { Article, NewArticle } from '../../db/schema';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { GetAdminArticlesDto } from './dto/get-admin-articles.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly articlesRepository: ArticlesRepository) {}

  /**
   * 前台：已发布文章列表（置顶优先，排序逻辑在 repository 中实现）
   */
  async getPublishedList(): Promise<Article[]> {
    return this.articlesRepository.findPublishedList();
  }

  /**
   * 前台：按 slug 获取详情
   * - 只返回已发布文章
   * - 每次访问浏览量 +1
   */
  async getBySlug(slug: string): Promise<Article | null> {
    const article = await this.articlesRepository.findBySlug(slug);

    // 没这篇，或者还不是已发布，前台统一视为 null
    if (!article || article.status !== 'published') {
      return null;
    }

    // 浏览量 +1（这里选择同步执行，保证返回的 viewCount 是最新的）
    await this.articlesRepository.incrementViewCount(article.id);

    return {
      ...article,
      viewCount: article.viewCount + 1,
    };
  }

  /**
   * 后台：按 ID 获取单篇（编辑页面用）
   */
  async getAdminById(id: number): Promise<Article | null> {
    return this.articlesRepository.findById(id);
  }

  /**
   * 后台：获取文章列表（含搜索 + 排序 + 分页）
   * 返回结构与 repository 一致：{ items, total, page, pageSize }
   */
  async getAdminList(query: GetAdminArticlesDto): Promise<{
    items: Article[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      q,
      status,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      pageSize = 20,
    } = query;

    return this.articlesRepository.findAdminList({
      q: q?.trim() || undefined,
      status: status ?? undefined,
      sortBy,
      order,
      page,
      pageSize,
    });
  }

  /**
   * 后台：创建文章
   * - 在真正写入数据库之前，先检查 slug 是否已经存在
   * - 如果存在，抛 ConflictException(409)，给前端明确提示
   */
  async createArticle(dto: CreateArticleDto): Promise<Article> {
    const now = new Date();

    // 统一把 slug 做一次 trim，避免因为多余空格导致“看起来一样其实不同”
    const slug = dto.slug.trim();

    // 1）先检查 slug 是否已存在
    const existed = await this.articlesRepository.findBySlug(slug);
    if (existed) {
      // 这里的信息会被前端拿来展示
      throw new ConflictException('SLUG 已存在，请提供一个新的 SLUG。');
    }

    const values: NewArticle = {
      title: dto.title,
      slug,
      summary: dto.summary ?? null,
      // content 通常是 NOT NULL，这里用空字符串兜底更安全
      content: dto.content ?? '',
      coverImageUrl: dto.coverImageUrl ?? null,
      status: dto.status,
      isPinned: dto.isPinned ?? false,
      viewCount: 0,
      // 如果 schema 里有这两个字段，则这样兜底：
      categoryId: (dto as any).categoryId ?? null,
      authorId: (dto as any).authorId ?? null,
      publishedAt: dto.status === 'published' ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    return this.articlesRepository.create(values);
  }

  /**
   * 后台：切换文章置顶状态
   */
  async togglePin(id: number, isPinned: boolean): Promise<Article> {
    const updated = await this.articlesRepository.update(id, { isPinned });

    if (!updated) {
      throw new NotFoundException('Article not found');
    }

    return updated;
  }

  /**
   * 后台：更新文章
   * （这里暂时不做 slug 冲突检查，后面如果你希望编辑 slug 时也给出 409 提示，
   *  可以用和 createArticle 类似的逻辑再加一段判断。）
   */
  async updateArticle(id: number, dto: UpdateArticleDto): Promise<Article> {
    const partial: Partial<NewArticle> = {
      title: dto.title,
      slug: dto.slug,
      summary: dto.summary ?? null,
      content: dto.content ?? '',
      coverImageUrl: dto.coverImageUrl ?? null,
      status: dto.status,
      isPinned: dto.isPinned,
      // 如果状态从草稿切到已发布，可以刷新发布时间；
      // 如果改回草稿，则清空发布时间；
      // 其他情况不动 publishedAt。
      publishedAt:
        dto.status === 'published'
          ? ((dto as any).publishedAt ?? new Date())
          : dto.status === 'draft'
            ? null
            : undefined,
      // 如果你 DTO 中也带有 categoryId / authorId，可以顺带更新：
      categoryId: (dto as any).categoryId ?? null,
      authorId: (dto as any).authorId ?? null,
    };

    const updated = await this.articlesRepository.update(id, partial);

    if (!updated) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    return updated;
  }

  /**
   * 后台：删除文章
   */
  async deleteArticle(id: number): Promise<void> {
    await this.articlesRepository.delete(id);
  }
}
