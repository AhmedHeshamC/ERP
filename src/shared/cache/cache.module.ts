import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';

@Module({
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService, CacheInterceptor],
})
export class CacheModule {}