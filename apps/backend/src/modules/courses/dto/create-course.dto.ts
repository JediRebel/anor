// apps/backend/src/modules/courses/dto/create-course.dto.ts

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Matches,
  ValidateIf,
} from 'class-validator';
import { courseStatusEnum, courseAccessTypeEnum } from '../../../db/schema';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Slug 不能为空' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug 只能包含小写字母、数字和连字符',
  })
  slug!: string;

  // [修改] 只有发布状态下，摘要才必填
  @ValidateIf((o) => o.status === 'published')
  @IsString()
  @IsNotEmpty({ message: '发布时必须填写摘要' })
  summary?: string;

  // [修改] 只有发布状态下，描述才必填
  @ValidateIf((o) => o.status === 'published')
  @IsString()
  @IsNotEmpty({ message: '发布时必须填写详细描述' })
  description?: string;

  // [修改] 只有发布状态下才校验 URL 格式，草稿允许为空
  @ValidateIf(
    (o) =>
      o.status === 'published' || (o.coverImageUrl && o.coverImageUrl !== ''),
  )
  @IsUrl({}, { message: '封面图片必须是有效的 URL' })
  @IsOptional()
  coverImageUrl?: string;

  @IsEnum(courseAccessTypeEnum.enumValues)
  accessType!: 'free' | 'paid';

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsEnum(courseStatusEnum.enumValues)
  status!: 'draft' | 'published';
}
