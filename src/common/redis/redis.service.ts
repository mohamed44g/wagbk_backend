import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: ReturnType<typeof createClient>;
  private connected = false;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('REDIS_ENABLED', 'false') === 'true';
    this.client = createClient({
      url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });
    this.client.on('error', (error) =>
      this.logger.warn(`Redis unavailable: ${this.errorMessage(error)}`),
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Redis is disabled; set REDIS_ENABLED=true to enable it');
      return;
    }
    try {
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis connection timed out')),
            2500,
          ),
        ),
      ]);
      this.connected = true;
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.warn(
        `Redis is optional in local development: ${this.errorMessage(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.client.quit();
  }

  get(key: string): Promise<string | null> {
    return this.connected ? this.client.get(key) : Promise.resolve(null);
  }

  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (this.connected) await this.client.set(key, value, { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    if (this.connected) await this.client.del(key);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
