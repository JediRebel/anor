// apps/backend/src/db/db.module.ts
import { Module, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

@Injectable()
export class DbService {
  public readonly db: NodePgDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const pool = new Pool({
      connectionString: databaseUrl,
    });

    this.db = drizzle(pool, { schema });
  }
}

@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}