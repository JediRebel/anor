// apps/backend/src/modules/tools/dto/save-tool-record.dto.ts
import { IsNotEmpty, IsString, IsObject } from 'class-validator';
import { ToolType } from '@anor/shared/src';

export class SaveToolRecordDto {
  @IsString()
  @IsNotEmpty()
  toolType!: ToolType;

  @IsObject()
  @IsNotEmpty()
  inputPayload: any; // 允许任意 JSON 结构

  @IsObject()
  @IsNotEmpty()
  resultPayload: any; // 允许任意 JSON 结构
}
