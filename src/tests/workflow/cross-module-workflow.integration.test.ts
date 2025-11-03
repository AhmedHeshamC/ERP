import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../../shared/cache/cache.module';
import { MonitoringModule } from '../../shared/monitoring/monitoring.module';
import { SalesModule } from '../../modules/sales/sales.module';
import { InventoryModule } from '../../modules/inventory/inventory.module';
import { AccountingModule } from '../../modules/accounting/accounting.module';
import { PrismaModule } from '../../shared/database/prisma.module';
import { WorkflowEngineService } from '../../shared/workflow/services/workflow-engine.service';
import { EventBusService } from '../../shared/events/services/event-bus.service';
import { RulesEngineService } from '../../shared/rules/services/rules-engine.service';
import { PerformanceService } from '../../shared/monitoring/performance.service';

describe('Cross-Module Workflow Integration Tests', () => {
  let module: TestingModule;
  let workflowEngine: WorkflowEngineService;
  let eventBus: EventBusService;
  let rulesEngine: RulesEngineService;
  let performanceService: PerformanceService;

  before(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              REDIS_URL: 'redis://localhost:6379',
              DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
            })
          ],
        }),
        PrismaModule,
        CacheModule,
        MonitoringModule,
        SalesModule,
        InventoryModule,
        AccountingModule,
      ],
    }).compile();

    workflowEngine = module.get<WorkflowEngineService>(WorkflowEngineService);
    eventBus = module.get<EventBusService>(EventBusService);
    rulesEngine = module.get<RulesEngineService>(RulesEngineService);
    performanceService = module.get<PerformanceService>(PerformanceService);
  });

  after(async () => {
    await module.close();
  });

  describe('Order-to-Cash Workflow (O2C)', () => {
    it('should complete full O2C workflow with performance tracking', async () => {
      // Arrange - Create order workflow
      const orderData = {
        customerId: 'customer-123',
        items: [
          { productId: 'product-1', quantity: 2, price: 100 },
          { productId: 'product-2', quantity: 1, price: 250 },
        ],
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
        },
      };

      // Act - Execute O2C workflow
      const workflowId = await workflowEngine.startWorkflow('order-to-cash', orderData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert - Workflow completed successfully
      expect(workflowResult.status).to.equal('completed');
      expect(workflowResult.data).to.have.property('orderId');
      expect(workflowResult.data).to.have.property('invoiceId');
      expect(workflowResult.data).to.have.property('paymentId');

      // Assert - Performance metrics were collected
      const metrics = performanceService.getMetrics();
      const workflowMetrics = metrics.filter(m =>
        m.endpoint?.includes('order-to-cash') ||
        m.endpoint?.includes('sales') ||
        m.endpoint?.includes('inventory') ||
        m.endpoint?.includes('accounting')
      );
      expect(workflowMetrics.length).to.be.greaterThan(0);
    });

    it('should handle inventory reservation and release in O2C workflow', async () => {
      // Arrange
      const orderData = {
        customerId: 'customer-456',
        items: [
          { productId: 'product-with-limited-stock', quantity: 3, price: 150 },
        ],
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('order-to-cash', orderData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert
      expect(workflowResult.status).to.equal('completed');

      // Check that inventory was properly managed
      const inventorySteps = workflowResult.steps.filter(s =>
        s.type === 'inventory-reservation' || s.type === 'inventory-release'
      );
      expect(inventorySteps.length).to.be.at.least(2); // Reserve and release
    });

    it('should trigger business rules validation during order processing', async () => {
      // Arrange - Order that should trigger specific rules
      const orderData = {
        customerId: 'new-customer-789',
        items: [
          { productId: 'restricted-product', quantity: 10, price: 50 },
        ],
        totalAmount: 500, // Above certain threshold
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('order-to-cash', orderData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert
      expect(workflowResult.status).to.equal('completed');

      // Check rules evaluation
      const ruleSteps = workflowResult.steps.filter(s =>
        s.type === 'rules-evaluation'
      );
      expect(ruleSteps.length).to.be.greaterThan(0);

      // Verify specific rules were evaluated
      expect(workflowResult.data).to.have.property('rulesApplied');
      expect(workflowResult.data.rulesApplied).to.include('credit-limit-check');
      expect(workflowResult.data.rulesApplied).to.include('product-restriction-check');
    });
  });

  describe('Procure-to-Pay Workflow (P2P)', () => {
    it('should complete P2P workflow with purchase order creation', async () => {
      // Arrange
      const requisitionData = {
        requestId: 'req-123',
        items: [
          { productId: 'office-supplies', quantity: 100, unitPrice: 5 },
          { productId: 'equipment', quantity: 2, unitPrice: 500 },
        ],
        requestedBy: 'user-456',
        urgency: 'normal',
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('procure-to-pay', requisitionData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert
      expect(workflowResult.status).to.equal('completed');
      expect(workflowResult.data).to.have.property('purchaseOrderId');
      expect(workflowResult.data).to.have.property('supplierId');
    });

    it('should handle supplier selection and approval workflow', async () => {
      // Arrange
      const procurementData = {
        category: 'electronic-components',
        specifications: {
          quality: 'premium',
          deliveryTime: '2-weeks',
          warranty: '2-years',
        },
        budget: 10000,
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('supplier-selection', procurementData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert
      expect(workflowResult.status).to.equal('completed');
      expect(workflowResult.data).to.have.property('selectedSupplier');
      expect(workflowResult.data).to.have.property('contractTerms');
    });
  });

  describe('Cross-Module Event Handling', () => {
    it('should propagate events across modules correctly', async () => {
      // Arrange - Setup event listeners
      const eventsReceived: any[] = [];

      eventBus.on('order.created', (event) => {
        eventsReceived.push({ type: 'order.created', data: event });
      });

      eventBus.on('inventory.reserved', (event) => {
        eventsReceived.push({ type: 'inventory.reserved', data: event });
      });

      eventBus.on('invoice.generated', (event) => {
        eventsReceived.push({ type: 'invoice.generated', data: event });
      });

      // Act - Create an order
      const orderData = {
        customerId: 'event-test-customer',
        items: [{ productId: 'test-product', quantity: 1, price: 100 }],
      };

      const workflowId = await workflowEngine.startWorkflow('order-to-cash', orderData);
      await workflowEngine.waitForCompletion(workflowId);

      // Assert - All expected events were published
      expect(eventsReceived.length).to.be.greaterThan(0);

      const eventTypes = eventsReceived.map(e => e.type);
      expect(eventTypes).to.include('order.created');
      expect(eventTypes).to.include('inventory.reserved');
      expect(eventTypes).to.include('invoice.generated');
    });

    it('should handle event-driven cache invalidation', async () => {
      // Arrange - Cache some product data
      const cacheService = module.get('CacheService');
      await cacheService.set('product:test-product', {
        id: 'test-product',
        name: 'Test Product',
        price: 100,
        lastUpdated: new Date('2023-01-01')
      });

      // Verify cache has data
      const cachedData = await cacheService.get('product:test-product');
      expect(cachedData).to.not.be.null;

      // Act - Update product (should trigger cache invalidation)
      const updateEventData = {
        productId: 'test-product',
        changes: { price: 120, name: 'Updated Test Product' },
        timestamp: new Date(),
      };

      await eventBus.publish('product.updated', updateEventData);

      // Wait a bit for cache invalidation to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Cache should be invalidated or updated
      const updatedCacheData = await cacheService.get('product:test-product');
      if (updatedCacheData) {
        // If cache exists, it should be updated
        expect(updatedCacheData.price).to.equal(120);
      }
      // Cache might be invalidated (null), which is also correct
    });
  });

  describe('Performance and Monitoring Integration', () => {
    it('should track performance metrics across all workflow steps', async () => {
      // Arrange
      const complexOrderData = {
        customerId: 'performance-test-customer',
        items: [
          { productId: 'product-1', quantity: 5, price: 100 },
          { productId: 'product-2', quantity: 3, price: 200 },
          { productId: 'product-3', quantity: 1, price: 500 },
        ],
        specialInstructions: 'This order requires special processing',
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('order-to-cash', complexOrderData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert - Performance metrics collected
      const metrics = performanceService.getMetrics();
      const workflowMetrics = metrics.filter(m =>
        m.correlationId === workflowId
      );

      expect(workflowMetrics.length).to.be.greaterThan(0);

      // Check that different modules contributed metrics
      const modules = new Set(workflowMetrics.map(m => m.endpoint?.split('/')[1]));
      expect(modules.size).to.be.greaterThan(1); // At least 2 different modules

      // Check performance alerts if any
      const alerts = performanceService.getPerformanceAlerts();
      expect(alerts).to.be.an('array');
    });

    it('should handle workflow failures with proper error tracking', async () => {
      // Arrange - Create order that should fail
      const invalidOrderData = {
        customerId: 'non-existent-customer',
        items: [
          { productId: 'non-existent-product', quantity: 1000, price: -50 },
        ],
      };

      // Act
      const workflowId = await workflowEngine.startWorkflow('order-to-cash', invalidOrderData);
      const workflowResult = await workflowEngine.waitForCompletion(workflowId);

      // Assert - Workflow should fail gracefully
      expect(workflowResult.status).to.equal('failed');
      expect(workflowResult.error).to.not.be.undefined;

      // Check error metrics were recorded
      const errorMetrics = performanceService.getMetrics().filter(m => m.hasError);
      expect(errorMetrics.length).to.be.greaterThan(0);
    });
  });

  describe('Cache Performance in Workflows', () => {
    it('should demonstrate cache hit benefits in repeated operations', async () => {
      // Arrange
      const cacheService = module.get('CacheService');
      cacheService.resetStats(); // Start with clean stats

      // Act - Execute same workflow multiple times
      const orderData = {
        customerId: 'cache-test-customer',
        items: [{ productId: 'cached-product', quantity: 1, price: 100 }],
      };

      for (let i = 0; i < 3; i++) {
        const workflowId = await workflowEngine.startWorkflow('order-to-cash', orderData);
        await workflowEngine.waitForCompletion(workflowId);
      }

      // Assert - Cache statistics should show improvement
      const stats = cacheService.getStats();
      expect(stats.totalRequests).to.be.greaterThan(0);
      expect(stats.hits).to.be.greaterThan(0);
      expect(stats.hitRate).to.be.greaterThan(0);
    });
  });
});