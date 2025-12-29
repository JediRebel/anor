// apps/backend/src/modules/me/me.controller.ts
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MeService } from './me.service';

export type MyCourseListItemDto = {
  courseId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  enrolledAt: string;
};

export type MeActionResultDto = {
  ok: true;
};

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('courses')
  @UseGuards(JwtAuthGuard)
  async myCourses(@Req() req: any): Promise<MyCourseListItemDto[]> {
    // 兼容你 JWT 里是 sub=3 的情况
    const rawId = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub ?? null;
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? Number(rawId)
          : null;

    // 理论上 JwtAuthGuard 通过时 userId 一定有值；这里保险处理
    return this.meService.listMyCourses(userId ?? 0);
  }

  @Post('courses/:courseSlug/join')
  @UseGuards(JwtAuthGuard)
  async joinCourse(
    @Param('courseSlug') courseSlug: string,
    @Req() req: any,
  ): Promise<MeActionResultDto> {
    if (!courseSlug || typeof courseSlug !== 'string') {
      throw new BadRequestException('Invalid course slug');
    }

    const rawId = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub ?? null;
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? Number(rawId)
          : null;

    if (!userId || userId <= 0) {
      throw new BadRequestException('Invalid user id');
    }

    // 下一步：在 MeService/Repository 中实现 join/quit 的真实逻辑（仅允许免费课程）
    const fn = (this.meService as any).joinFreeCourse as
      | ((userId: number, courseSlug: string) => Promise<void>)
      | undefined;

    if (typeof fn !== 'function') {
      throw new ServiceUnavailableException(
        'joinFreeCourse is not implemented yet',
      );
    }

    await fn(userId, courseSlug);
    return { ok: true };
  }

  @Delete('courses/:courseSlug/quit')
  @UseGuards(JwtAuthGuard)
  async quitCourse(
    @Param('courseSlug') courseSlug: string,
    @Req() req: any,
  ): Promise<MeActionResultDto> {
    if (!courseSlug || typeof courseSlug !== 'string') {
      throw new BadRequestException('Invalid course slug');
    }

    const rawId = req?.user?.id ?? req?.user?.userId ?? req?.user?.sub ?? null;
    const userId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? Number(rawId)
          : null;

    if (!userId || userId <= 0) {
      throw new BadRequestException('Invalid user id');
    }

    // 下一步：在 MeService/Repository 中实现 join/quit 的真实逻辑（仅允许免费课程）
    const fn = (this.meService as any).quitFreeCourse as
      | ((userId: number, courseSlug: string) => Promise<void>)
      | undefined;

    if (typeof fn !== 'function') {
      throw new ServiceUnavailableException(
        'quitFreeCourse is not implemented yet',
      );
    }

    await fn(userId, courseSlug);
    return { ok: true };
  }
}
