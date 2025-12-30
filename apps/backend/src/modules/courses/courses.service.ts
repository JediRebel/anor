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
    // 可以在这里增加 slug 唯一性检查，或者依赖数据库的 Unique Constraint 报错
    return this.coursesRepository.create(data);
  }

  async updateCourse(id: string, data: Partial<NewCourse>) {
    await this.getCourseByIdAdmin(id); // Ensure exists
    return this.coursesRepository.update(id, data);
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

    return this.lessonsRepository.create(payload);
  }

  async updateLesson(id: string, data: Partial<NewLesson>) {
    // 这里暂不处理 order 的复杂重排，仅支持修改基本信息
    return this.lessonsRepository.update(id, data);
  }

  async deleteLesson(id: string) {
    return this.lessonsRepository.delete(id);
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
