import { Module } from '@nestjs/common';
import { SupplierPerformanceController } from './performance.controller';
import { SupplierPerformanceService } from './performance.service';
import { CommonModule } from '../../../shared/common/common.module';

/**
 * Supplier Performance Module
 * Manages supplier performance tracking, analytics, and scorecard management
 * Follows SOLID principles with clean separation of concerns
 */
@Module({
  imports: [CommonModule],
  controllers: [SupplierPerformanceController],
  providers: [
    SupplierPerformanceService,
  ],
  exports: [SupplierPerformanceService],
})
export class SupplierPerformanceModule {}