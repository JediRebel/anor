// apps/backend/src/modules/courses/courses.module.ts

import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CoursesController } from './courses.controller';
import { CoursesAdminController } from './courses.admin.controller'; // <--- Import
import { CoursesService } from './courses.service';
import { CoursesRepository } from './courses.repository';
import { LessonsRepository } from './lessons.repository';
import { EnrollmentsRepository } from './enrollments.repository';

@Module({
  imports: [DbModule],
  controllers: [
    CoursesController,
    CoursesAdminController, // <--- Register
  ],
  providers: [
    CoursesService,
    CoursesRepository,
    LessonsRepository,
    EnrollmentsRepository,
  ],
  exports: [CoursesService],
})
export class CoursesModule {}
