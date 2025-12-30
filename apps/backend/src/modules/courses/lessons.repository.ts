// apps/backend/src/modules/courses/lessons.repository.ts

import { Injectable } from '@nestjs/common';
import { asc, eq, max } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { lessons } from '../../db/schema';
import type { NewLesson } from '../../db/schema';

@Injectable()
export class LessonsRepository {
  constructor(private readonly db: DbService) {}

  async create(data: NewLesson) {
    const rows = await this.db.db.insert(lessons).values(data).returning();
    return rows[0];
  }

  async update(id: string, data: Partial<NewLesson>) {
    const rows = await this.db.db
      .update(lessons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lessons.id, id))
      .returning();
    return rows[0];
  }

  async delete(id: string) {
    const rows = await this.db.db
      .delete(lessons)
      .where(eq(lessons.id, id))
      .returning();
    return rows[0];
  }

  async findById(id: string) {
    const rows = await this.db.db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1);
    return rows[0] || null;
  }

  /**
   * Admin: List all lessons for a specific course (ordered by order asc)
   */
  async findAllByCourseId(courseId: string) {
    return this.db.db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.order));
  }

  /**
   * Helper: Find the max 'order' in a course to help append new lessons at the end.
   */
  async findMaxOrder(courseId: string): Promise<number> {
    const rows = await this.db.db
      .select({ maxVal: max(lessons.order) })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));
    return rows[0]?.maxVal ?? 0;
  }
}
