import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CommonModule } from '../../shared/common/common.module';
import { SecurityModule } from '../../shared/security/security.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuditModule } from '../../shared/audit/audit.module';

@Module({
  imports: [CommonModule, SecurityModule, CacheModule, AuthenticationModule, AuditModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UsersModule {}