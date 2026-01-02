import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
