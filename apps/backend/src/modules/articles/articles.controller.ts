// apps/backend/src/modules/articles/articles.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Article } from '../../db/schema';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /**
   * 前台：文章列表（只返回已发布）
   * GET /articles
   */
  @Get()
  async list(): Promise<Article[]> {
    return this.articlesService.getPublishedList();
  }

  /**
   * 前台：文章详情
   * GET /articles/:slug
   */
  @Get(':slug')
  async detail(
    @Param('slug') slug: string,
  ): Promise<Article | null> {
    return this.articlesService.getBySlug(slug);
  }
}