// apps/backend/src/modules/me/me.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import type { MyCourseListItemDto } from './me.controller';
import { MeRepository } from './me.repository';

@Injectable()
export class MeService {
  constructor(private readonly meRepository: MeRepository) {}

  async listMyCourses(userId: number): Promise<MyCourseListItemDto[]> {
    return this.meRepository.listMyCourses(userId);
  }

  joinFreeCourse = async (
    userId: number,
    courseSlug: string,
  ): Promise<void> => {
    if (!userId || userId <= 0) {
      throw new BadRequestException('Invalid user id');
    }
    if (!courseSlug || typeof courseSlug !== 'string') {
      throw new BadRequestException('Invalid course slug');
    }

    await this.meRepository.joinFreeCourse(userId, courseSlug);
  };

  quitFreeCourse = async (
    userId: number,
    courseSlug: string,
  ): Promise<void> => {
    if (!userId || userId <= 0) {
      throw new BadRequestException('Invalid user id');
    }
    if (!courseSlug || typeof courseSlug !== 'string') {
      throw new BadRequestException('Invalid course slug');
    }

    await this.meRepository.quitFreeCourse(userId, courseSlug);
  };
}
