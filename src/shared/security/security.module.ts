import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityService } from './security.service';
import { SecurityValidationService } from './services/security-validation.service';

@Module({
  imports: [ConfigModule],
  providers: [SecurityService, SecurityValidationService],
  exports: [SecurityService, SecurityValidationService],
})
export class SecurityModule {}