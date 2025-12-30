// apps/backend/src/modules/courses/courses.repository.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  PublicCourseDetailDto,
  PublicCourseListItemDto,
  PublicLessonDetailDto,
  PublicLessonListItemDto,
} from './courses.controller';

// 补充定义：因为 listPublishedFreeCourses 用到了这个局部类型
type FreeCourseListItemDto = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  accessType: 'free';
  priceCents: number | null;
  isEnrolled: boolean;
};

import { DbService } from '../../db/db.service';
import { courses, enrollments, lessons } from '../../db/schema';
import type { NewCourse } from '../../db/schema';

@Injectable()
export class CoursesRepository {
  constructor(private readonly db: DbService) {}

  // =================================================================
  //  Admin Methods (For Management)
  // =================================================================

  async create(data: NewCourse) {
    const rows = await this.db.db.insert(courses).values(data).returning();
    return rows[0];
  }

  async update(id: string, data: Partial<NewCourse>) {
    const rows = await this.db.db
      .update(courses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return rows[0];
  }

  async delete(id: string) {
    const rows = await this.db.db
      .delete(courses)
      .where(eq(courses.id, id))
      .returning();
    return rows[0];
  }

  async findByIdAdmin(id: string) {
    const rows = await this.db.db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async findAllAdmin() {
    // 管理端列表：按创建时间倒序，包含草稿和已发布
    return this.db.db.select().from(courses).orderBy(desc(courses.createdAt));
  }

  // =================================================================
  //  Public Methods (Existing)
  // =================================================================

  /**
   * Public: list published courses
   * 仅返回列表页需要的字段。
   */
  async listPublishedCourses(): Promise<PublicCourseListItemDto[]> {
    const rows = await this.db.db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        coverImageUrl: courses.coverImageUrl,
        publishedAt: courses.publishedAt,
        accessType: courses.accessType,
        priceCents: courses.priceCents,
      })
      .from(courses)
      .where(eq(courses.status, 'published'))
      .orderBy(desc(courses.publishedAt), desc(courses.createdAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      accessType: r.accessType ?? null,
      priceCents: typeof r.priceCents === 'number' ? r.priceCents : null,
    }));
  }

  /**
   * Public: list published FREE courses
   * - 未登录：isEnrolled 固定为 false
   * - 已登录：返回 isEnrolled（用于“加入课程/退出学习”按钮态）
   */
  async listPublishedFreeCourses(
    userId: number | null = null,
  ): Promise<FreeCourseListItemDto[]> {
    // 未登录：不 join enrollments，避免无意义的数据库 join
    if (!userId) {
      const rows = await this.db.db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          summary: courses.summary,
          coverImageUrl: courses.coverImageUrl,
          publishedAt: courses.publishedAt,
          accessType: courses.accessType,
          priceCents: courses.priceCents,
        })
        .from(courses)
        .where(
          and(eq(courses.status, 'published'), eq(courses.accessType, 'free')),
        )
        .orderBy(desc(courses.publishedAt), desc(courses.createdAt));

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        summary: r.summary ?? null,
        coverImageUrl: r.coverImageUrl ?? null,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        accessType: 'free',
        priceCents: typeof r.priceCents === 'number' ? r.priceCents : null,
        isEnrolled: false,
      }));
    }

    // 已登录：left join enrollments，计算 isEnrolled
    const rows = await this.db.db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        coverImageUrl: courses.coverImageUrl,
        publishedAt: courses.publishedAt,
        accessType: courses.accessType,
        priceCents: courses.priceCents,
        enrolledId: enrollments.id,
      })
      .from(courses)
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.courseId, courses.id),
          eq(enrollments.userId, userId),
        ),
      )
      .where(
        and(eq(courses.status, 'published'), eq(courses.accessType, 'free')),
      )
      .orderBy(desc(courses.publishedAt), desc(courses.createdAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      accessType: 'free',
      priceCents: typeof r.priceCents === 'number' ? r.priceCents : null,
      isEnrolled: Boolean(r.enrolledId),
    }));
  }

  /**
   * Public: course detail by slug (published only)
   * 仅返回详情页需要的字段。
   */
  async getPublishedCourseBySlug(slug: string): Promise<PublicCourseDetailDto> {
    const rows = await this.db.db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        description: courses.description,
        coverImageUrl: courses.coverImageUrl,
        publishedAt: courses.publishedAt,
        accessType: courses.accessType,
        priceCents: courses.priceCents,
      })
      .from(courses)
      .where(and(eq(courses.status, 'published'), eq(courses.slug, slug)))
      .limit(1);

    const r = rows[0];
    if (!r) {
      throw new NotFoundException('Course not found');
    }

    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? null,
      description: r.description ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      accessType: r.accessType ?? null,
      priceCents: typeof r.priceCents === 'number' ? r.priceCents : null,
    };
  }

  /**
   * Public: list published lessons of a published course by course slug
   */
  async listPublishedLessonsByCourseSlug(
    slug: string,
  ): Promise<PublicLessonListItemDto[]> {
    // 通过 join 保证：课程必须是 published，且只返回 published lessons
    const rows = await this.db.db
      .select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        order: lessons.order,
        type: lessons.type,
        isFreePreview: lessons.isFreePreview,
      })
      .from(lessons)
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(
        and(
          eq(courses.status, 'published'),
          eq(courses.slug, slug),
          eq(lessons.status, 'published'),
        ),
      )
      .orderBy(asc(lessons.order));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      order: r.order,
      type: r.type,
      isFreePreview: r.isFreePreview,
    }));
  }

  /**
   * Public: lesson detail by course slug + lesson slug
   * 规则：
   * - 课程必须 published；课节必须 published
   * - 未登录/未 enrolled：只能访问 isFreePreview=true
   * - 已 enrolled：可访问全部课节内容
   */
  async getLessonByCourseSlugAndLessonSlug(
    courseSlug: string,
    lessonSlug: string,
    userId: number | null = null,
  ): Promise<PublicLessonDetailDto> {
    const rows = await this.db.db
      .select({
        id: lessons.id,
        courseId: lessons.courseId,
        title: lessons.title,
        slug: lessons.slug,
        order: lessons.order,
        type: lessons.type,
        isFreePreview: lessons.isFreePreview,
        videoUrl: lessons.videoUrl,
        contentText: lessons.contentText,
      })
      .from(lessons)
      .innerJoin(courses, eq(lessons.courseId, courses.id))
      .where(
        and(
          eq(courses.status, 'published'),
          eq(courses.slug, courseSlug),
          eq(lessons.status, 'published'),
          eq(lessons.slug, lessonSlug),
        ),
      )
      .limit(1);

    const r = rows[0];
    if (!r) {
      throw new NotFoundException('Lesson not found');
    }

    // 免费预览：直接放行
    if (r.isFreePreview) {
      return {
        id: r.id,
        courseId: r.courseId,
        title: r.title,
        slug: r.slug,
        order: r.order,
        type: r.type,
        isFreePreview: r.isFreePreview,
        videoUrl: r.videoUrl ?? null,
        contentText: r.contentText ?? null,
      };
    }

    // 非预览：必须已登录且 enrolled
    if (!userId) {
      throw new ForbiddenException('Lesson is locked');
    }

    const enrollment = await this.db.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, r.courseId),
          eq(enrollments.userId, userId),
        ),
      )
      .limit(1);

    if (enrollment.length === 0) {
      throw new ForbiddenException('Lesson is locked');
    }

    return {
      id: r.id,
      courseId: r.courseId,
      title: r.title,
      slug: r.slug,
      order: r.order,
      type: r.type,
      isFreePreview: r.isFreePreview,
      videoUrl: r.videoUrl ?? null,
      contentText: r.contentText ?? null,
    };
  }
}
