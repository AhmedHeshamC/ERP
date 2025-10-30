import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { SupplierPerformanceModule } from './performance/performance.module';

@Module({
  controllers: [SupplierController, PurchaseOrderController],
  providers: [SupplierService, PurchaseOrderService],
  exports: [SupplierService, PurchaseOrderService],
  imports: [SupplierPerformanceModule],
})
export class PurchasingModule {}