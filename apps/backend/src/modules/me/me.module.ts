// apps/backend/src/modules/me/me.module.ts
import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';

@Module({
  imports: [DbModule],
  controllers: [MeController],
  providers: [MeService, MeRepository],
})
export class MeModule {}
