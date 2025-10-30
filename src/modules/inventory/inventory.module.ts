import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

/**
 * Inventory Module
 * Provides comprehensive inventory management capabilities
 * Following SOLID principles with clear separation of concerns
 * Follows KISS principle with focused implementation
 */
@Module({
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class InventoryModule {}