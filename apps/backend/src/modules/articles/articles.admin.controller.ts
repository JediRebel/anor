// apps/backend/src/modules/articles/articles.admin.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Article } from '../../db/schema';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { GetAdminArticlesDto } from './dto/get-admin-articles.dto';
// 👇 新增的几个 import：JWT 守卫 + 角色装饰器/守卫
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard) // 先经过 JWT 校验，再做角色校验
@Roles('admin')                      // 整个 controller 只有 admin 能访问
@Controller('admin/articles')
export class ArticlesAdminController {
  constructor(private readonly articlesService: ArticlesService) {}

  /**
   * 后台接口：GET /admin/articles
   * 支持搜索 + 排序 + 分页
   * 返回结构：{ items, total, page, pageSize }
   */
  @Get()
  async adminList(
    @Query() query: GetAdminArticlesDto,
  ): Promise<{
    items: Article[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.articlesService.getAdminList(query);
  }

  /**
   * 后台按 ID 查询单篇：GET /admin/articles/:id
   */
  @Get(':id')
  async adminDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Article | null> {
    return this.articlesService.getAdminById(id);
  }

  /**
   * 后台接口：POST /admin/articles
   * 创建文章
   */
  @Post()
  async create(@Body() dto: CreateArticleDto): Promise<Article> {
    return this.articlesService.createArticle(dto);
  }

  /**
   * 后台接口：PUT /admin/articles/:id
   * 更新文章
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArticleDto,
  ): Promise<Article> {
    return this.articlesService.updateArticle(id, dto);
  }

  /**
   * 后台接口：PATCH /admin/articles/:id/pin
   * 切换置顶
   */
  @Patch(':id/pin')
  async togglePin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isPinned: boolean },
  ): Promise<Article> {
    return this.articlesService.togglePin(id, body.isPinned);
  }

  /**
   * 后台接口：DELETE /admin/articles/:id
   * 删除文章
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.articlesService.deleteArticle(id);
  }
}