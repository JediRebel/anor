// apps/backend/src/modules/courses/courses.service.ts
import { Injectable } from '@nestjs/common';
import type {
  PublicCourseDetailDto,
  PublicCourseListItemDto,
  PublicLessonDetailDto,
  PublicLessonListItemDto,
} from './courses.controller';
import { CoursesRepository } from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  /**
   * Public: list published courses
   */
  async listPublishedCourses(): Promise<PublicCourseListItemDto[]> {
    return this.coursesRepository.listPublishedCourses();
  }

  /**
   * Public: list published FREE courses
   * - 未登录：isEnrolled 固定为 false
   * - 已登录：返回 isEnrolled（用于“加入课程/退出学习”按钮态）
   */
  async listPublishedFreeCourses(user: any | null): Promise<any[]> {
    const rawId = user?.id ?? user?.userId ?? user?.sub ?? null;
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? Number(rawId)
          : null;

    return this.coursesRepository.listPublishedFreeCourses(userId);
  }

  /**
   * Public: course detail by slug (published only)
   */
  async getPublishedCourseBySlug(slug: string): Promise<PublicCourseDetailDto> {
    return this.coursesRepository.getPublishedCourseBySlug(slug);
  }

  /**
   * Public: list published lessons of a published course by course slug
   */
  async listPublishedLessonsByCourseSlug(
    slug: string,
  ): Promise<PublicLessonListItemDto[]> {
    return this.coursesRepository.listPublishedLessonsByCourseSlug(slug);
  }

  /**
   * Public: lesson detail by course slug + lesson slug
   * 当前先打通“可选登录”的调用链：user 先收进来，下一步在 Repository 做 enrolled 放行。
   */
  async getLessonByCourseSlugAndLessonSlug(
    courseSlug: string,
    lessonSlug: string,
    user: any | null,
  ): Promise<PublicLessonDetailDto> {
    // Optional JWT：不同实现里 user 可能是 { id }、{ userId }、{ sub } 或字符串
    const rawId = user?.id ?? user?.userId ?? user?.sub ?? null;
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? Number(rawId)
          : null;

    return this.coursesRepository.getLessonByCourseSlugAndLessonSlug(
      courseSlug,
      lessonSlug,
      userId,
    );
  }
}
