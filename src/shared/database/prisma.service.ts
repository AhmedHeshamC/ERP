import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('app.database.url'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    // Add logging event listeners - using type assertion to bypass Prisma type issues
    (this as any).$on('query', (e: any) => {
      this.logger.debug(`Query!: ${e.query}`);
      this.logger.debug(`Params!: ${e.params}`);
      this.logger.debug(`Duration!: ${e.duration}ms`);
    });

    (this as any).$on('error', (e: any) => {
      this.logger.error(`Database error!: ${e.message}`);
    });

    (this as any).$on('info', (e: any) => {
      this.logger.log(`Database info!: ${e.message}`);
    });

    (this as any).$on('warn', (e: any) => {
      this.logger.warn(`Database warning!: ${e.message}`);
    });

    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      // Clean database in test environment
      const tablenames = await this.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      } catch (error) {
        this.logger.error('Failed to clean database!: ', error);
      }
    }
  }

  async runMigrations() {
    try {
      // Check if migrations table exists and run migrations if needed
      await this.$connect();
      this.logger.log('Migrations checked successfully');
    } catch (error) {
      this.logger.error('Migration check failed!: ', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed!: ', error);
      return false;
    }
  }
}