// apps/backend/src/modules/tools/tools.service.ts

import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { schema } from '../../db/schema';
import { SaveToolRecordDto } from './dto/save-tool-record.dto';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ToolsService {
  constructor(private readonly db: DbService) {}

  // 保存记录
  async saveRecord(userId: number, dto: SaveToolRecordDto) {
    // 修正：使用 this.db.db 访问 Drizzle 实例
    const [record] = await this.db.db
      .insert(schema.toolRecords)
      .values({
        userId,
        toolType: dto.toolType,
        inputPayload: dto.inputPayload,
        resultPayload: dto.resultPayload,
      })
      .returning();
    return record;
  }

  // 获取用户的所有历史记录（按时间倒序）
  async getUserHistory(userId: number) {
    // 修正：使用 this.db.db 访问 Drizzle 实例
    return this.db.db.query.toolRecords.findMany({
      where: eq(schema.toolRecords.userId, userId),
      orderBy: [desc(schema.toolRecords.createdAt)],
    });
  }
}
