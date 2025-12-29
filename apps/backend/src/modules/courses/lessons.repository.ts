// apps/backend/src/modules/courses/lessons.repository.ts

import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';

@Injectable()
export class LessonsRepository {
  constructor(private readonly db: DbService) {}
}
