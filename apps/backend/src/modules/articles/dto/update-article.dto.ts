// apps/backend/src/modules/articles/dto/update-article.dto.ts
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '标题长度至少 2 个字符' })
  @MaxLength(255, { message: '标题长度不能超过 255 个字符' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Slug 长度至少 3 个字符' })
  @MaxLength(120, { message: 'Slug 长度不能超过 120 个字符' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug 只能包含小写字母、数字和中划线，不能以中划线开头或结尾，单词之间请用中划线连接。',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '摘要长度不能超过 500 个字符' })
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512, { message: '封面图片地址长度不能超过 512 个字符' })
  coverImageUrl?: string;

  // draft / published
  @IsOptional()
  @IsIn(['draft', 'published'], {
    message: 'status 只能是 draft 或 published',
  })
  status?: 'draft' | 'published';

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}