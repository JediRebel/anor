// apps/backend/src/db/db.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbService } from './db.service';

@Module({
  imports: [ConfigModule],      // 如果你已经在别处全局引入 ConfigModule，这行也可以保留
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}