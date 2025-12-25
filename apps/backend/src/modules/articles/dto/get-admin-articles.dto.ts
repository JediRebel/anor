// apps/backend/src/modules/articles/dto/get-admin-articles.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAdminArticlesDto {
  /**
   * 关键词搜索（标题 / 摘要 / 内容）
   */
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * 文章状态：draft / published
   */
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  /**
   * 排序字段
   */
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'title'])
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'viewCount' | 'title';

  /**
   * 排序方向
   */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  /**
   * 第几页（从 1 开始）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /**
   * 每页条数
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}