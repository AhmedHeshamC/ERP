import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './shared/database/prisma.module';
import { SecurityModule } from './shared/security/security.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { UsersModule } from './modules/users/users.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CommonModule } from './shared/common/common.module';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),

    // Rate Limiting (OWASP A04)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
            limit: configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
          },
          {
            ttl: 60 * 1000, // 1 minute for sensitive endpoints
            limit: 5,
            route: ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/forgot-password'],
          },
        ],
      }),
      inject: [ConfigService],
    }),

    // Database
    PrismaModule,

    // Security
    SecurityModule,

    // Common
    CommonModule,

    // Static Files
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: join(__dirname, '..', 'public'),
          serveRoot: '/static',
        },
      ],
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthenticationModule,
    UsersModule,
    AccountingModule,
    InventoryModule,
    SalesModule,
    PurchasingModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}