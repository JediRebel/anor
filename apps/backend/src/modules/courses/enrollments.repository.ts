// apps/backend/src/modules/courses/enrollments.repository.ts

import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { enrollments } from '../../db/schema';
import type { NewEnrollment } from '../../db/schema';

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly db: DbService) {}

  async add(data: NewEnrollment) {
    const rows = await this.db.db.insert(enrollments).values(data).returning();
    return rows[0];
  }

  async remove(userId: number, courseId: string) {
    const rows = await this.db.db
      .delete(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
      )
      .returning();
    return rows[0];
  }

  async check(userId: number, courseId: string): Promise<boolean> {
    const rows = await this.db.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
      )
      .limit(1);
    return rows.length > 0;
  }
}
