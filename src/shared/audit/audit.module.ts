import { Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditController } from './controllers/audit.controller';
import { PrismaModule } from '../database/prisma.module';
import { AuthenticationModule } from '../../modules/authentication/authentication.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [PrismaModule, AuthenticationModule, SecurityModule],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}