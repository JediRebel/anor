// apps/backend/src/modules/courses/dto/create-lesson.dto.ts

import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
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

  @IsString()
  @IsOptional()
  @IsUrl()
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
