// apps/backend/src/modules/courses/courses.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoursesRepository } from './courses.repository';
import { LessonsRepository } from './lessons.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import type { NewCourse, NewLesson } from '../../db/schema';
import type {
  PublicCourseDetailDto,
  PublicCourseListItemDto,
  PublicLessonDetailDto,
  PublicLessonListItemDto,
} from './courses.controller';

@Injectable()
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly lessonsRepository: LessonsRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  // =================================================================
  //  Admin: Course Management
  // =================================================================

  async listAllCoursesAdmin() {
    return this.coursesRepository.findAllAdmin();
  }

  async getCourseByIdAdmin(id: string) {
    const course = await this.coursesRepository.findByIdAdmin(id);
    if (!course) {
      throw new NotFoundException(`Course not found: ${id}`);
    }
    return course;
  }

  async createCourse(data: NewCourse) {
    return this.coursesRepository.create(data);
  }

  async updateCourse(id: string, data: Partial<NewCourse>) {
    // 1. 先获取当前课程信息，用于判断状态变化
    const currentCourse = await this.getCourseByIdAdmin(id); // 内部已包含 NotFound 检查

    const updatePayload = { ...data };

    // 2. 核心逻辑：如果新状态是 'published'，且原课程没发布过（或发布时间为空），则自动写入当前时间
    if (
      updatePayload.status === 'published' &&
      !currentCourse.publishedAt &&
      !updatePayload.publishedAt // 防止覆盖前端可能传过来的特定时间
    ) {
      updatePayload.publishedAt = new Date();
    }

    // 3. 调用 Repository 更新 (Repository 会自动处理 updatedAt)
    return this.coursesRepository.update(id, updatePayload);
  }

  async deleteCourse(id: string) {
    await this.getCourseByIdAdmin(id); // Ensure exists
    return this.coursesRepository.delete(id);
  }

  // =================================================================
  //  Admin: Lesson Management
  // =================================================================

  async listLessonsAdmin(courseId: string) {
    return this.lessonsRepository.findAllByCourseId(courseId);
  }

  async createLesson(
    courseId: string,
    // 这里排除了 id, createdAt, updatedAt, order, courseId，由逻辑生成
    data: Omit<
      NewLesson,
      'id' | 'createdAt' | 'updatedAt' | 'order' | 'courseId'
    >,
  ) {
    // 1. 自动计算 Order: 查出当前最大 order，+1
    const maxOrder = await this.lessonsRepository.findMaxOrder(courseId);
    const newOrder = maxOrder + 1;

    // 2. 构造完整数据
    const payload: NewLesson = {
      ...data,
      courseId,
      order: newOrder,
    };

    const newLesson = await this.lessonsRepository.create(payload);

    // [新增] 3. 课节变动，由于逻辑定义“课程更新时间”包含“课节更新”，
    // 这里显式触发一次 Course 的更新 (Repository 会自动设置 updatedAt = now)
    await this.coursesRepository.update(courseId, { updatedAt: new Date() });

    return newLesson;
  }

  async updateLesson(id: string, data: Partial<NewLesson>) {
    // 1. 更新课节
    const updatedLesson = await this.lessonsRepository.update(id, data);

    // [新增] 2. 如果更新成功，且能获取到 courseId，则触碰父级课程更新时间
    if (updatedLesson && updatedLesson.courseId) {
      await this.coursesRepository.update(updatedLesson.courseId, {
        updatedAt: new Date(),
      });
    }

    return updatedLesson;
  }

  async deleteLesson(id: string) {
    // 1. 删除课节
    const deletedLesson = await this.lessonsRepository.delete(id);

    // [新增] 2. 如果删除成功，则触碰父级课程更新时间
    if (deletedLesson && deletedLesson.courseId) {
      await this.coursesRepository.update(deletedLesson.courseId, {
        updatedAt: new Date(),
      });
    }

    return deletedLesson;
  }

  // =================================================================
  //  Public: Course & Lesson Access
  // =================================================================

  async listPublishedCourses(): Promise<PublicCourseListItemDto[]> {
    return this.coursesRepository.listPublishedCourses();
  }

  async listPublishedFreeCourses(user: any | null): Promise<any[]> {
    const userId = this.extractUserId(user);
    return this.coursesRepository.listPublishedFreeCourses(userId);
  }

  async getPublishedCourseBySlug(slug: string): Promise<PublicCourseDetailDto> {
    return this.coursesRepository.getPublishedCourseBySlug(slug);
  }

  async listPublishedLessonsByCourseSlug(
    slug: string,
  ): Promise<PublicLessonListItemDto[]> {
    return this.coursesRepository.listPublishedLessonsByCourseSlug(slug);
  }

  async getLessonByCourseSlugAndLessonSlug(
    courseSlug: string,
    lessonSlug: string,
    user: any | null,
  ): Promise<PublicLessonDetailDto> {
    const userId = this.extractUserId(user);
    // Repository 内部已经封装了 "check free preview OR check enrollment" 的逻辑
    return this.coursesRepository.getLessonByCourseSlugAndLessonSlug(
      courseSlug,
      lessonSlug,
      userId,
    );
  }

  // =================================================================
  //  User Actions (Enrollment)
  // =================================================================

  /**
   * 用户加入免费课程
   */
  async joinFreeCourse(user: any, courseId: string) {
    const userId = this.extractUserId(user);
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // 1. 检查课程是否存在且是免费的
    const course = await this.coursesRepository.findByIdAdmin(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.accessType !== 'free') {
      throw new BadRequestException('This course is not free');
    }

    // 2. 检查是否已经加入
    const exists = await this.enrollmentsRepository.check(userId, courseId);
    if (exists) {
      // 如果已加入，直接返回成功，或者抛出 ConflictException，视前端交互而定。
      // 这里为了幂等性，直接返回“成功”即可
      return { success: true, message: 'Already enrolled' };
    }

    // 3. 写入报名记录
    await this.enrollmentsRepository.add({
      userId,
      courseId,
      source: 'manual', // 用户主动加入
    });

    return { success: true };
  }

  // =================================================================
  //  Helpers
  // =================================================================

  private extractUserId(user: any): number | null {
    const rawId = user?.id ?? user?.userId ?? user?.sub ?? null;
    if (typeof rawId === 'number') return rawId;
    if (typeof rawId === 'string' && /^\d+$/.test(rawId)) return Number(rawId);
    return null;
  }
}
