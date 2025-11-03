/**
 * P2P (Procure-to-Pay) Module
 * Following SOLID principles with dependency injection and clean architecture
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/database/prisma.module';
import { CommonModule } from '../../shared/common/common.module';
import { SecurityModule } from '../../shared/security/security.module';
import { AuditModule } from '../../shared/audit/audit.module';
import { WorkflowModule } from '../../shared/workflow/workflow.module';
import { RulesEngineModule } from '../../shared/rules/rules.module';
import { EventBusModule } from '../../shared/events/event.module';

// Import existing modules for integration
import { PurchasingModule } from '../purchasing/purchasing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';

// Import P2P services (will be created)
import { PurchaseRequisitionService } from './services/requisition.service';
import { SupplierManagementService } from './services/supplier-management.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { ReceivingService } from './services/receiving.service';
import { ThreeWayMatchingService } from './services/three-way-matching.service';
import { InvoiceProcessingService } from './services/invoice-processing.service';
import { PaymentExecutionService } from './services/payment-execution.service';

// Import P2P controllers (will be created)
import { PurchaseRequisitionController } from './controllers/requisition.controller';
import { SupplierManagementController } from './controllers/supplier-management.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { ReceivingController } from './controllers/receiving.controller';
import { InvoiceProcessingController } from './controllers/invoice-processing.controller';
import { PaymentExecutionController } from './controllers/payment-execution.controller';

// Import P2P workflow and event services
import { P2PWorkflowService } from './services/p2p-workflow.service';
import { P2PEventService } from './services/p2p-event.service';
import { P2PAnalyticsService } from './services/p2p-analytics.service';
import { P2PConfigurationService } from './services/p2p-configuration.service';

@Module({
  imports: [
    // Core shared modules
    PrismaModule,
    CommonModule,
    SecurityModule,
    AuditModule,

    // Integration modules
    WorkflowModule,
    RulesEngineModule,
    EventBusModule,

    // Existing business modules
    PurchasingModule,
    InventoryModule,
    AccountingModule,
  ],
  controllers: [
    // P2P API Controllers
    PurchaseRequisitionController,
    SupplierManagementController,
    PurchaseOrderController,
    ReceivingController,
    InvoiceProcessingController,
    PaymentExecutionController,
  ],
  providers: [
    // Core P2P Services
    PurchaseRequisitionService,
    SupplierManagementService,
    PurchaseOrderService,
    ReceivingService,
    ThreeWayMatchingService,
    InvoiceProcessingService,
    PaymentExecutionService,

    // Supporting P2P Services
    P2PWorkflowService,
    P2PEventService,
    P2PAnalyticsService,
    P2PConfigurationService,
  ],
  exports: [
    // Export services for external integration
    PurchaseRequisitionService,
    SupplierManagementService,
    PurchaseOrderService,
    ReceivingService,
    ThreeWayMatchingService,
    InvoiceProcessingService,
    PaymentExecutionService,
    P2PWorkflowService,
    P2PEventService,
    P2PAnalyticsService,
    P2PConfigurationService,
  ],
})
export class P2PModule {}