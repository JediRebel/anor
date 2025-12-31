// apps/backend/src/modules/courses/courses.controller.ts

import { Controller, Get, Param, Req, UseGuards, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CoursesService } from './courses.service';

// 可选 JWT：有 token 就解析出 req.user；没有 token 也放行（req.user 为 null）
class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: any) {
    if (err) return null;
    return user ?? null;
  }
}

export type PublicCourseListItemDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;

  // Phase 6: 课程访问控制（免费/付费）与价格（分）
  accessType: 'free' | 'paid' | null;
  priceCents: number | null;
};

export type PublicCourseDetailDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;

  // Phase 6: 课程访问控制（免费/付费）与价格（分）
  accessType: 'free' | 'paid' | null;
  priceCents: number | null;
};

export type PublicFreeCourseListItemDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;

  accessType: 'free';
  priceCents: number | null;

  // 已登录用户：是否已加入（用于按钮态）
  // 未登录：固定 false
  isEnrolled: boolean;
};

export type PublicLessonListItemDto = {
  id: string;
  title: string;
  slug: string;
  order: number;
  type: 'video' | 'text';
  isFreePreview: boolean;
};

export type PublicLessonDetailDto = {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  order: number;
  type: 'video' | 'text';
  isFreePreview: boolean;
  videoUrl: string | null;
  contentText: string | null;
};

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  /**
   * Public: list published courses
   */
  @Get()
  async listPublishedCourses(): Promise<PublicCourseListItemDto[]> {
    const items = (await this.coursesService.listPublishedCourses()) as any[];

    return items.map((c) => ({
      ...c,
      accessType: c?.accessType ?? null,
      priceCents: typeof c?.priceCents === 'number' ? c.priceCents : null,
    })) as PublicCourseListItemDto[];
  }
  @Delete(':id')
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(id);
  }
  /**
   * Public: list published FREE courses (for "All Free Courses" entry)
   * - 未登录：isEnrolled 固定 false
   * - 已登录：返回 isEnrolled（用于“加入课程/退出学习”按钮态）
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('free')
  async listPublishedFreeCourses(
    @Req() req: any,
  ): Promise<PublicFreeCourseListItemDto[]> {
    const items = (await this.coursesService.listPublishedFreeCourses(
      req.user ?? null,
    )) as any[];

    return items.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      summary: c.summary ?? null,
      coverImageUrl: c.coverImageUrl ?? null,
      publishedAt: c.publishedAt ?? null,
      accessType: 'free',
      priceCents: typeof c?.priceCents === 'number' ? c.priceCents : null,
      isEnrolled: Boolean(c?.isEnrolled),
    })) as PublicFreeCourseListItemDto[];
  }

  /**
   * Public: lesson detail by course slug + lesson slug
   * 访问规则：未 enrolled 只能访问 isFreePreview=true；已 enrolled 可访问全部（下一步实现）。
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug/lessons/:lessonSlug')
  async getLessonByCourseSlugAndLessonSlug(
    @Param('slug') slug: string,
    @Param('lessonSlug') lessonSlug: string,
    @Req() req: any,
  ): Promise<PublicLessonDetailDto> {
    return this.coursesService.getLessonByCourseSlugAndLessonSlug(
      slug,
      lessonSlug,
      req.user ?? null,
    );
  }

  /**
   * Public: list published lessons of a published course by course slug
   */
  @Get(':slug/lessons')
  async listPublishedLessonsByCourseSlug(
    @Param('slug') slug: string,
  ): Promise<PublicLessonListItemDto[]> {
    return this.coursesService.listPublishedLessonsByCourseSlug(slug);
  }

  /**
   * Public: course detail by slug (published only)
   */
  @Get(':slug')
  async getPublishedCourseBySlug(
    @Param('slug') slug: string,
  ): Promise<PublicCourseDetailDto> {
    const c = (await this.coursesService.getPublishedCourseBySlug(slug)) as any;

    return {
      ...c,
      accessType: c?.accessType ?? null,
      priceCents: typeof c?.priceCents === 'number' ? c.priceCents : null,
    } as PublicCourseDetailDto;
  }
}
