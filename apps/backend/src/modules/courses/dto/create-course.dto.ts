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
} from 'class-validator';
import { courseAccessTypeEnum, courseStatusEnum } from '../../../db/schema';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must only contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsEnum(courseAccessTypeEnum.enumValues)
  @IsOptional()
  accessType?: 'free' | 'paid';

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @IsEnum(courseStatusEnum.enumValues)
  @IsOptional()
  status?: 'draft' | 'published';
}
