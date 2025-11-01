import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { CommonModule } from '../../shared/common/common.module';

/**
 * Inventory Module
 * Provides comprehensive inventory management capabilities
 * Following SOLID principles with clear separation of concerns
 * Follows KISS principle with focused implementation
 */
@Module({
  imports: [CommonModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class InventoryModule {}