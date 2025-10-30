import { Module } from '@nestjs/common';
import { SupplierPerformanceController } from './performance.controller';
import { SupplierPerformanceService } from './performance.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';

/**
 * Supplier Performance Module
 * Manages supplier performance tracking, analytics, and scorecard management
 * Follows SOLID principles with clean separation of concerns
 */
@Module({
  controllers: [SupplierPerformanceController],
  providers: [
    SupplierPerformanceService,
    PrismaService,
    SecurityService,
  ],
  exports: [SupplierPerformanceService],
})
export class SupplierPerformanceModule {}