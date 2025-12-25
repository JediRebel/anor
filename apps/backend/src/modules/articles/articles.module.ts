// apps/backend/src/modules/articles/articles.module.ts
import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesAdminController } from './articles.admin.controller';
import { ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';
import { DbModule } from '../../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService, ArticlesRepository],
  exports: [ArticlesService],
})
export class ArticlesModule {}