import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { AuditModule } from '../../shared/audit/audit.module';
import { CommonModule } from '../../shared/common/common.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { ProductController } from './controllers/product.controller';
import { StockController } from './controllers/stock.controller';
import { InventoryValuationController } from './controllers/inventory-valuation.controller';
import { WarehouseController } from './controllers/warehouse.controller';
import { LowStockAlertController } from './controllers/low-stock-alert.controller';

// Services
import { ProductService } from './services/product.service';
import { StockService } from './services/stock.service';
import { InventoryValuationService } from './services/inventory-valuation.service';
import { WarehouseService } from './services/warehouse.service';
import { LowStockAlertService } from './services/low-stock-alert.service';

// Guards
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';

/**
 * Inventory Module
 * Provides comprehensive inventory management capabilities
 * Following SOLID principles with clear separation of concerns
 * Follows KISS principle with focused implementation
 *
 * Features:
 * - Product Management with full CRUD operations
 * - Stock Management with movements, adjustments, and transfers
 * - Inventory Valuation with FIFO/LIFO/Weighted Average methods
 * - Warehouse Management with location-based tracking
 * - Low Stock Alerts with reorder point management
 * - Comprehensive audit logging for all operations
 * - Role-based access control and security
 * - Real-time stock tracking and reporting
 */
@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    AuditModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    ProductController,
    StockController,
    InventoryValuationController,
    WarehouseController,
    LowStockAlertController,
  ],
  providers: [
    ProductService,
    StockService,
    InventoryValuationService,
    WarehouseService,
    LowStockAlertService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    ProductService,
    StockService,
    InventoryValuationService,
    WarehouseService,
    LowStockAlertService,
  ],
})
export class InventoryModule {}