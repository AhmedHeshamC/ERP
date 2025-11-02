import { Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditController } from './controllers/audit.controller';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}