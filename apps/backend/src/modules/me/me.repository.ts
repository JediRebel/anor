// apps/backend/src/modules/me/me.repository.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { courses, enrollments } from '../../db/schema';

export type MyCourseListItemRow = {
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  enrolledAt: string;
};

@Injectable()
export class MeRepository {
  constructor(private readonly db: DbService) {}

  async listMyCourses(userId: number): Promise<MyCourseListItemRow[]> {
    const rows = await this.db.db
      .select({
        courseId: enrollments.courseId,
        title: courses.title,
        slug: courses.slug,
        summary: courses.summary,
        coverImageUrl: courses.coverImageUrl,
        enrolledAt: enrollments.createdAt,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.createdAt));

    return rows.map((r) => ({
      courseId: r.courseId,
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      enrolledAt: r.enrolledAt.toISOString(),
    }));
  }

  async joinFreeCourse(userId: number, courseSlug: string): Promise<void> {
    const courseRows = await this.db.db
      .select({
        id: courses.id,
        status: courses.status,
        accessType: courses.accessType,
      })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    const course = courseRows[0];
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== 'published') {
      throw new BadRequestException('Course is not published');
    }

    if (course.accessType !== 'free') {
      throw new BadRequestException('Course is not free');
    }

    // 幂等：重复加入不会报错
    // 备注：使用不带 target 的 ON CONFLICT DO NOTHING，避免数据库侧唯一约束/索引与 target 不匹配时报错
    try {
      await this.db.db
        .insert(enrollments)
        .values({
          userId,
          courseId: course.id,
          source: 'manual',
        })
        .onConflictDoNothing();
    } catch {
      throw new BadRequestException('Failed to join course');
    }
  }

  async quitFreeCourse(userId: number, courseSlug: string): Promise<void> {
    const courseRows = await this.db.db
      .select({
        id: courses.id,
        status: courses.status,
        accessType: courses.accessType,
      })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    const course = courseRows[0];
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== 'published') {
      throw new BadRequestException('Course is not published');
    }

    if (course.accessType !== 'free') {
      throw new BadRequestException('Course is not free');
    }

    await this.db.db
      .delete(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, course.id),
        ),
      );
  }
}
