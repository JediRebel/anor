import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveToolRecordDto } from './dto/save-tool-record.dto';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  // 保存计算结果 (需要登录)
  @Post('save')
  @UseGuards(JwtAuthGuard)
  async saveRecord(@Req() req: any, @Body() dto: SaveToolRecordDto) {
    // req.user 在 JwtStrategy 验证通过后会被自动挂载
    return this.toolsService.saveRecord(req.user.userId, dto);
  }

  // 获取我的历史记录 (需要登录)
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any) {
    return this.toolsService.getUserHistory(req.user.userId);
  }
}
