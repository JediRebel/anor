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

import type { Express } from 'express';

// ================ 统一管理文章封面图的存储 & 对外 URL ================

// 物理存储位置（本地磁盘）
// 将来如果改成“先落本地再异步上传到对象存储”，这一行也可以继续复用
const ARTICLE_COVER_DISK_DIR = 'public/uploads/article-covers';

// 对外访问前缀：
//
// - 开发环境：默认仍然是相对路径 `/uploads/article-covers`，由 Nest 静态目录提供
// - 生产环境：可以通过环境变量 ARTICLE_COVER_URL_PREFIX 指向 CDN / 对象存储
//   例如：ARTICLE_COVER_URL_PREFIX=https://cdn.anorvisa.com/article-covers
//
const RAW_ARTICLE_COVER_URL_PREFIX =
  process.env.ARTICLE_COVER_URL_PREFIX || '/uploads/article-covers';

// 规范化前缀（去掉尾部 /，避免出现 //）
const ARTICLE_COVER_URL_PREFIX = RAW_ARTICLE_COVER_URL_PREFIX.replace(
  /\/$/,
  '',
);

// 生成对外可访问的 URL；将来接入对象存储 / CDN 时，只需要保证这里返回正确的公网地址即可
function buildArticleCoverPublicUrl(filename: string): string {
  return `${ARTICLE_COVER_URL_PREFIX}/${filename}`;
}

// ================ Multer 存储配置（当前阶段：本地磁盘） ================

const articleCoverMulterStorage = diskStorage({
  destination: ARTICLE_COVER_DISK_DIR,
  filename: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const randomName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, randomName + extname(file.originalname));
  },
});

@Controller('admin/uploads')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.Admin)
export class UploadsController {
  @Post('article-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: articleCoverMulterStorage,
      fileFilter: (
        _req: any,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
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

    // 现在开始，前端拿到的是一个“稳定的对外 URL”，
    // 将来迁移到对象存储 / CDN 时，只需要调整 buildArticleCoverPublicUrl 即可。
    const url = buildArticleCoverPublicUrl(file.filename);

    return { url };
  }
}
