// apps/backend/src/modules/courses/courses.admin.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller('admin/courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin) // 修正这里：ADMIN -> Admin
export class CoursesAdminController {
  constructor(private readonly coursesService: CoursesService) {}

  // ==========================
  // Course Management
  // ==========================

  @Get()
  async listAllCourses() {
    return this.coursesService.listAllCoursesAdmin();
  }

  @Get(':id')
  async getCourse(@Param('id') id: string) {
    return this.coursesService.getCourseByIdAdmin(id);
  }

  @Post()
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto);
  }

  @Patch(':id')
  async updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.updateCourse(id, dto);
  }

  @Delete(':id')
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(id);
  }

  // ==========================
  // Lesson Management
  // ==========================

  @Get(':courseId/lessons')
  async listLessons(@Param('courseId') courseId: string) {
    return this.coursesService.listLessonsAdmin(courseId);
  }

  @Post(':courseId/lessons')
  async createLesson(
    @Param('courseId') courseId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.coursesService.createLesson(courseId, dto);
  }

  @Patch('lessons/:id')
  async updateLesson(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.coursesService.updateLesson(id, dto);
  }

  @Delete('lessons/:id')
  async deleteLesson(@Param('id') id: string) {
    return this.coursesService.deleteLesson(id);
  }
}
