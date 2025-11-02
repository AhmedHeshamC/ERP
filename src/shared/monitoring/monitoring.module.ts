import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PerformanceService } from './performance.service';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';
import { PerformanceController } from './controllers/performance.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    CacheModule,
  ],
  providers: [
    PerformanceService,
    PerformanceInterceptor,
  ],
  controllers: [
    PerformanceController,
  ],
  exports: [
    PerformanceService,
    PerformanceInterceptor,
  ],
})
export class MonitoringModule {}