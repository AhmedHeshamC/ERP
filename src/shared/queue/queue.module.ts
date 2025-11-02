import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { JobService } from './job.service';
import { JobController } from './controllers/job.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    CacheModule,
  ],
  providers: [
    JobService,
  ],
  controllers: [
    JobController,
  ],
  exports: [
    JobService,
  ],
})
export class QueueModule {}