import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { SecurityModule } from '../../shared/security/security.module';
import { CommonModule } from '../../shared/common/common.module';

/**
 * Inventory Module
 * Provides comprehensive inventory management capabilities
 * Following SOLID principles with clear separation of concerns
 * Follows KISS principle with focused implementation
 */
@Module({
  imports: [SecurityModule, CommonModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class InventoryModule {}