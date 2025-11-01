import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { CommonModule } from '../../shared/common/common.module';

// Controllers
import { CustomerController } from './controllers/customer.controller';
import { OrderController } from './controllers/order.controller';
import { InvoiceController } from './controllers/invoice.controller';

// Services
import { CustomerService } from './services/customer.service';
import { OrderService } from './services/order.service';
import { InvoiceService } from './services/invoice.service';

// DTOs are automatically picked up by NestJS when referenced in controllers

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    CommonModule,
  ],
  controllers: [
    CustomerController,
    OrderController,
    InvoiceController,
  ],
  providers: [
    CustomerService,
    OrderService,
    InvoiceService,
  ],
  exports: [
    CustomerService,
    OrderService,
    InvoiceService,
  ],
})
export class SalesModule {}