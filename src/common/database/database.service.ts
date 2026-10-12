import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      host: this.config.get<string>('HOMEWORK_DB_HOST', 'localhost'),
      port: this.config.get<number>('HOMEWORK_DB_PORT', 5432),
      database: this.config.get<string>(
        'HOMEWORK_DB_NAME',
        'homework_management',
      ),
      user: this.config.get<string>('HOMEWORK_DB_USER', 'postgres'),
      password: this.config.get<string>('HOMEWORK_DB_PASSWORD'),
      max: this.config.get<number>('HOMEWORK_DB_POOL_MAX', 20),
      connectionTimeoutMillis: 3000,
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Checking PostgreSQL connection');
    await this.pool.query('SELECT 1');
    this.logger.log('PostgreSQL connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ) {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
