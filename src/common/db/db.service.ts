import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  public readonly pool: Pool;
  public readonly db: NodePgDatabase;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>('DATABASE_URL', {
      infer: true,
    });
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
