// apps/backend/src/modules/uploads/uploads.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { existsSync, mkdirSync } from 'fs'; // 引入 fs 模块用于自动创建目录

import type { Express } from 'express';

// ===========================================================================
//  配置区域：文章 (Articles)
// ===========================================================================

const ARTICLE_COVER_DISK_DIR = 'public/uploads/article-covers';

const RAW_ARTICLE_COVER_URL_PREFIX =
  process.env.ARTICLE_COVER_URL_PREFIX || '/uploads/article-covers';

const ARTICLE_COVER_URL_PREFIX = RAW_ARTICLE_COVER_URL_PREFIX.replace(
  /\/$/,
  '',
);

function buildArticleCoverPublicUrl(filename: string): string {
  // 如果是完整的 http 开头（例如 CDN），直接拼接；否则拼接成相对路径
  if (ARTICLE_COVER_URL_PREFIX.startsWith('http')) {
    return `${ARTICLE_COVER_URL_PREFIX}/${filename}`;
  }
  // 开发环境/本地环境，需要确保返回给前端的是完整 URL (包含 host) 或者根路径
  // 这里暂时返回相对路径，前端配合 <img src> 使用，或者由前端拼接 host
  // 为了方便，这里我们保持原逻辑，返回路径部分
  return `${ARTICLE_COVER_URL_PREFIX}/${filename}`;
}

const articleCoverMulterStorage = diskStorage({
  destination: (req, file, cb) => {
    // 确保目录存在，不存在则创建
    if (!existsSync(ARTICLE_COVER_DISK_DIR)) {
      mkdirSync(ARTICLE_COVER_DISK_DIR, { recursive: true });
    }
    cb(null, ARTICLE_COVER_DISK_DIR);
  },
  filename: (req, file, cb) => {
    const randomName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, randomName + extname(file.originalname));
  },
});

// ===========================================================================
//  配置区域：课程 (Courses) - [新增]
// ===========================================================================

// 1. 物理存储位置
const COURSE_COVER_DISK_DIR = 'public/uploads/course-covers';

// 2. 对外 URL 前缀
const RAW_COURSE_COVER_URL_PREFIX =
  process.env.COURSE_COVER_URL_PREFIX || '/uploads/course-covers';

const COURSE_COVER_URL_PREFIX = RAW_COURSE_COVER_URL_PREFIX.replace(/\/$/, '');

function buildCourseCoverPublicUrl(filename: string): string {
  return `${COURSE_COVER_URL_PREFIX}/${filename}`;
}

// 3. Multer 存储配置
const courseCoverMulterStorage = diskStorage({
  destination: (req, file, cb) => {
    // 自动创建目录
    if (!existsSync(COURSE_COVER_DISK_DIR)) {
      mkdirSync(COURSE_COVER_DISK_DIR, { recursive: true });
    }
    cb(null, COURSE_COVER_DISK_DIR);
  },
  filename: (req, file, cb) => {
    const randomName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, randomName + extname(file.originalname));
  },
});

// ===========================================================================
//  Controller
// ===========================================================================

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.Admin)
export class UploadsController {
  // -------------------------------------------------------
  // 1. 文章封面上传
  // -------------------------------------------------------
  @Post('article-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: articleCoverMulterStorage,
      fileFilter: (req, file, cb) => {
        if (!file?.mimetype || !file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('只允许上传图片文件'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadArticleCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('没有收到文件');
    }
    // 注意：这里需要根据你的 main.ts 里的静态资源配置来决定
    // 如果你配置了 addPrefix: false，可能需要手动拼 http://localhost:3001
    // 这里我们先返回相对路径/CDN路径
    const url = buildArticleCoverPublicUrl(file.filename);
    return { url };
  }

  // -------------------------------------------------------
  // 2. 课程封面上传 - [新增]
  // -------------------------------------------------------
  @Post('course-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: courseCoverMulterStorage, // 使用课程专用的存储配置
      fileFilter: (req, file, cb) => {
        if (!file?.mimetype || !file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('只允许上传图片文件'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadCourseCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('没有收到文件');
    }
    const url = buildCourseCoverPublicUrl(file.filename);

    // 如果是本地开发环境，为了方便前端直接预览，这里可以补全 host
    // (可选优化)
    const fullUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}${url}`
      : `http://localhost:3001${url}`;

    return { url: fullUrl };
  }
}
