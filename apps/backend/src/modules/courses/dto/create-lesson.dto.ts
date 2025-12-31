// apps/backend/src/modules/courses/dto/create-lesson.dto.ts

import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateIf, // [新增]
} from 'class-validator';
import { lessonStatusEnum, lessonTypeEnum } from '../../../db/schema';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsEnum(lessonTypeEnum.enumValues)
  @IsOptional()
  type?: 'video' | 'text';

  // [修改] 复杂的校验逻辑
  @ValidateIf((o) => {
    // 1. 如果是“发布”状态且类型为“视频”，则必须校验（非空 + URL格式）
    if (o.type === 'video' && o.status === 'published') return true;

    // 2. 即使是草稿，如果用户填了值（不为空字符串），也必须校验 URL 格式
    if (o.type === 'video' && o.videoUrl && o.videoUrl !== '') return true;

    // 3. 其他情况（如类型为图文，或草稿且为空），跳过校验
    return false;
  })
  @IsNotEmpty({ message: '发布视频课节时，视频 URL 不能为空' })
  @IsUrl({}, { message: 'videoUrl must be a URL address' })
  videoUrl?: string;

  @IsString()
  @IsOptional()
  contentText?: string;

  @IsBoolean()
  @IsOptional()
  isFreePreview?: boolean;

  @IsEnum(lessonStatusEnum.enumValues)
  @IsOptional()
  status?: 'draft' | 'published';
}
