import { Module } from '@nestjs/common';
import { SupplierPerformanceController } from './performance.controller';
import { SupplierPerformanceService } from './performance.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityModule } from '../../../shared/security/security.module';

/**
 * Supplier Performance Module
 * Manages supplier performance tracking, analytics, and scorecard management
 * Follows SOLID principles with clean separation of concerns
 */
@Module({
  imports: [SecurityModule],
  controllers: [SupplierPerformanceController],
  providers: [
    SupplierPerformanceService,
    PrismaService,
  ],
  exports: [SupplierPerformanceService],
})
export class SupplierPerformanceModule {}