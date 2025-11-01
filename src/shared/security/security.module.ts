import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityService } from './security.service';
import { SecurityValidationService } from './services/security-validation.service';
import { PermissionsService } from './permissions.service';
import { ResourceBasedGuard } from './guards/resource-based.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    SecurityService,
    SecurityValidationService,
    PermissionsService,
    ResourceBasedGuard,
  ],
  exports: [
    SecurityService,
    SecurityValidationService,
    PermissionsService,
    ResourceBasedGuard,
  ],
})
export class SecurityModule {}