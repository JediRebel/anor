// apps/backend/src/modules/courses/enrollments.repository.ts

import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly db: DbService) {}
}
